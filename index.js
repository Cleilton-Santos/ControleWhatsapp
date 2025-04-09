// index.js
require('dotenv').config({ path: '.env' });
const axios = require('axios');
const twilio = require('twilio');
const dns = require('dns');

// =============================================
// CONFIGURAÇÕES GLOBAIS
// =============================================
const CONFIG = {
  ENDPOINTS: process.env.SMARTGPS_ENDPOINTS?.split(',') || [
    'https://sp-beta.tracker-net.app/api'
  ],
  TIMEOUT: parseInt(process.env.SMARTGPS_TIMEOUT_MS) || 15000,
  DEBUG_MODE: process.env.DEBUG === 'true',
  RAIO_DETECCAO_KM: parseFloat(process.env.RAIO_DETECCAO_KM) || 0.2,
  INTERVALO_MINUTOS: parseInt(process.env.INTERVALO_MINUTOS) || 1
};

dns.setServers(['8.8.8.8', '1.1.1.1']);

const requiredEnvVars = [
  'SMARTGPS_EMAIL', 'SMARTGPS_PASSWORD',
  'TWILIO_SID', 'TWILIO_AUTH_TOKEN', 'WHATSAPP_NUMBER', 'TWILIO_WHATSAPP_NUMBER',
  'DESTINO_LAT', 'DESTINO_LON'
];

function verificarVariaveisAmbiente() {
  let ok = true;
  requiredEnvVars.forEach(varName => {
    if (!process.env[varName]) {
      console.error(`❌ Variável faltando: ${varName}`);
      ok = false;
    }
  });
  if (!ok) {
    console.error('\n⛔ Adicione as variáveis no arquivo .env');
    process.exit(1);
  }
}
verificarVariaveisAmbiente();

const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);
const DESTINO = {
  lat: parseFloat(process.env.DESTINO_LAT),
  lon: parseFloat(process.env.DESTINO_LON)
};

class SmartGPSMonitor {
  constructor() {
    this.tokenCache = {
      value: null,
      expiresAt: null,
      endpoint: null
    };
    this.caminhoesNotificados = new Set();
  }

  async testarEndpoint(url) {
    try {
      const form = new URLSearchParams();
      form.append('email', process.env.SMARTGPS_EMAIL);
      form.append('password', process.env.SMARTGPS_PASSWORD);
  
      const response = await axios.post(`${url}/login`, form.toString(), {
        timeout: 5000,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        }
      });
  
      return { url, active: true };
    } catch (err) {
      if (CONFIG.DEBUG_MODE) {
        console.error(`🔴 Falha ao testar endpoint ${url}:`, err.response?.status, err.message);
      }
      return { url, active: false };
    }
  }
  

  async encontrarEndpointAtivo() {
    for (const endpoint of CONFIG.ENDPOINTS) {
      const teste = await this.testarEndpoint(endpoint);
      if (teste.active) {
        if (CONFIG.DEBUG_MODE) console.log(`🟢 Endpoint ativo: ${endpoint}`);
        return endpoint;
      }
    }
    throw new Error('Todos endpoints falharam');
  }

  async autenticar() {
    if (this.tokenCache.value && new Date() < this.tokenCache.expiresAt) {
      return this.tokenCache.value;
    }

    const endpoint = this.tokenCache.endpoint || await this.encontrarEndpointAtivo();

    const form = new URLSearchParams();
    form.append('email', process.env.SMARTGPS_EMAIL);
    form.append('password', process.env.SMARTGPS_PASSWORD);

    const response = await axios.post(`${endpoint}/login`, form.toString(), {
      timeout: CONFIG.TIMEOUT,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      }
    });

    const token = response.data.user_api_hash;

    this.tokenCache = {
      value: token,
      expiresAt: new Date(Date.now() + 55 * 60 * 1000),
      endpoint
    };

    return token;
  }

  async buscarVeiculos() {
    try {
      const token = await this.autenticar();
      const response = await axios.get(`${this.tokenCache.endpoint}/get_devices`, {
        timeout: CONFIG.TIMEOUT,
        params: {
          user_api_hash: token,
          lang: 'pt'
        }
      });

      const grupos = response.data || [];
      return grupos.flatMap(grupo => grupo.items || []);

    } catch (error) {
      console.error('Erro ao buscar veículos:', error.message);
      return [];
    }
  }

  calcularDistancia(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  async enviarNotificacao(placa, distancia) {
    const mensagem = `🚨 ALERTA: Caminhão ${placa} chegou a ${distancia.toFixed(2)}km do destino.`;
    try {
      await client.messages.create({
        body: mensagem,
        from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
        to: `whatsapp:${process.env.WHATSAPP_NUMBER}`
      });
      console.log(`📤 Notificação enviada para ${placa}`);
    } catch (error) {
      console.error('Erro ao enviar WhatsApp:', error.message);
    }
  }

  async monitorar() {
    if (CONFIG.DEBUG_MODE) console.log('\n🔍 Iniciando ciclo de monitoramento...');

    const veiculos = await this.buscarVeiculos();

    for (const veiculo of veiculos) {
      const placa = veiculo.name;
      const latitude = veiculo.lat;
      const longitude = veiculo.lng;

      if (!latitude || !longitude || this.caminhoesNotificados.has(placa)) continue;

      const distancia = this.calcularDistancia(latitude, longitude, DESTINO.lat, DESTINO.lon);

      if (CONFIG.DEBUG_MODE) {
        console.log(`ℹ️ ${placa} - Distância: ${distancia.toFixed(3)} km`);
      }

      if (distancia <= CONFIG.RAIO_DETECCAO_KM) {
        this.caminhoesNotificados.add(placa);
        await this.enviarNotificacao(placa, distancia);
      }
    }
  }
}

async function iniciarSistema() {
  console.log('\n=== SISTEMA DE MONITORAMENTO SMARTGPS ===');
  console.log(`📍 Destino: ${DESTINO.lat}, ${DESTINO.lon}`);
  console.log(`🕒 Intervalo: ${CONFIG.INTERVALO_MINUTOS} minuto(s)`);
  console.log(`🔎 Raio: ${CONFIG.RAIO_DETECCAO_KM} km`);
  console.log('=========================================');

  const monitor = new SmartGPSMonitor();

  await monitor.monitorar();

  const intervalo = setInterval(() => monitor.monitorar(), CONFIG.INTERVALO_MINUTOS * 60 * 1000);

  process.on('SIGINT', () => {
    clearInterval(intervalo);
    console.log('\n🛑 Monitoramento encerrado');
    process.exit(0);
  });
}

iniciarSistema();
