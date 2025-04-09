require('dotenv').config({ path: '.env' });
const axios = require('axios');
const twilio = require('twilio');
const dns = require('dns');

// =============================================
// CONFIGURAÇÕES GLOBAIS
// =============================================
const CONFIG = {
  // Endpoints prioritários (ordem de tentativa)
  ENDPOINTS: process.env.SMARTGPS_ENDPOINTS?.split(',') || [
    'https://api.smartgps.com.br/v3',
    'https://smartgpsapi.com/v2',
    'http://76.76.21.21/v2'  // Fallback via IP
  ],
  TIMEOUT: parseInt(process.env.SMARTGPS_TIMEOUT_MS) || 15000,
  DEBUG_MODE: process.env.DEBUG === 'true',
  RAIO_DETECCAO_KM: parseFloat(process.env.RAIO_DETECCAO_KM) || 0.2,
  INTERVALO_MINUTOS: parseInt(process.env.INTERVALO_MINUTOS) || 1
};

// Configura DNS públicos como fallback
dns.setServers(['8.8.8.8', '1.1.1.1']);

// =============================================
// VERIFICAÇÃO DAS VARIÁVEIS DE AMBIENTE
// =============================================
const requiredEnvVars = [
  'SMARTGPS_EMAIL', 'SMARTGPS_PASSWORD', 'SMARTGPS_CLIENT_ID',
  'TWILIO_SID', 'TWILIO_AUTH_TOKEN', 'WHATSAPP_NUMBER',
  'DESTINO_LAT', 'DESTINO_LON'
];

function verificarVariaveisAmbiente() {
  let todasPresentes = true;
  requiredEnvVars.forEach(varName => {
    if (!process.env[varName]) {
      console.error(`❌ Variável faltando: ${varName}`);
      todasPresentes = false;
    }
  });
  if (!todasPresentes) {
    console.error('\n⛔ Adicione as variáveis no arquivo .env');
    process.exit(1);
  }
}
verificarVariaveisAmbiente();

// =============================================
// INICIALIZAÇÃO DE SERVIÇOS
// =============================================
const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);
const DESTINO = {
  lat: parseFloat(process.env.DESTINO_LAT),
  lon: parseFloat(process.env.DESTINO_LON)
};

// =============================================
// CLASSE PRINCIPAL DO MONITORAMENTO
// =============================================
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
      const response = await axios.options(url, { 
        timeout: 5000,
        headers: {
          'Accept': 'application/json'
        }
      });
      return {
        url,
        active: true,
        methods: response.headers['allow']
      };
    } catch (error) {
      if (CONFIG.DEBUG_MODE) {
        console.debug(`🔴 Endpoint ${url} falhou:`, error.code || error.message);
      }
      return { url, active: false };
    }
  }

  async encontrarEndpointAtivo() {
    // Tenta endpoints na ordem configurada
    for (const endpoint of CONFIG.ENDPOINTS) {
      const teste = await this.testarEndpoint(endpoint);
      if (teste.active) {
        if (CONFIG.DEBUG_MODE) {
          console.log(`🟢 Endpoint ativo: ${endpoint} (Métodos: ${teste.methods})`);
        }
        return endpoint;
      }
    }
    throw new Error('Todos endpoints falharam');
  }

  async autenticar() {
    if (this.tokenCache.value && new Date() < this.tokenCache.expiresAt) {
      return this.tokenCache.value;
    }

    try {
      const endpoint = this.tokenCache.endpoint || await this.encontrarEndpointAtivo();
      
      const response = await axios.post(
        `${endpoint}/auth/login`,
        {
          email: process.env.SMARTGPS_EMAIL,
          password: process.env.SMARTGPS_PASSWORD,
          client_id: process.env.SMARTGPS_CLIENT_ID
        },
        {
          timeout: CONFIG.TIMEOUT,
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.api+json'
          }
        }
      );

      this.tokenCache = {
        value: response.data.token,
        expiresAt: new Date(Date.now() + 3300 * 1000), // 55 minutos
        endpoint
      };

      return this.tokenCache.value;
    } catch (error) {
      console.error('Erro na autenticação:', {
        status: error.response?.status,
        data: error.response?.data || error.message
      });
      throw error;
    }
  }

  async buscarVeiculos() {
    try {
      const token = await this.autenticar();
      const response = await axios.get(
        `${this.tokenCache.endpoint}/vehicles`,
        {
          timeout: CONFIG.TIMEOUT,
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-Client-ID': process.env.SMARTGPS_CLIENT_ID,
            'Accept-Version': '2.0.0'
          }
        }
      );
      return response.data?.data || [];
    } catch (error) {
      console.error('Erro ao buscar veículos:', {
        status: error.response?.status,
        error: error.response?.data?.message || error.message
      });
      return [];
    }
  }

  calcularDistancia(lat1, lon1, lat2, lon2) {
    const R = 6371; // Raio da Terra em km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  async enviarNotificacao(placa, distancia) {
    const mensagem = `🚨 ALERTA: Caminhão ${placa} chegou a ${distancia.toFixed(2)}km`;
    try {
      await client.messages.create({
        body: mensagem,
        from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
        to: `whatsapp:${process.env.WHATSAPP_NUMBER}`
      });
      console.log(`📤 Notificação enviada: ${placa}`);
    } catch (error) {
      console.error('Erro no WhatsApp:', error.message);
    }
  }

  async monitorar() {
    try {
      if (CONFIG.DEBUG_MODE) console.log('\n🔍 Iniciando ciclo de monitoramento...');
      
      const veiculos = await this.buscarVeiculos();
      if (veiculos.length === 0 && CONFIG.DEBUG_MODE) {
        console.log('ℹ️ Nenhum veículo encontrado');
      }

      for (const veiculo of veiculos) {
        const { placa, latitude, longitude } = veiculo;
        if (!this.caminhoesNotificados.has(placa)) {
          const distancia = this.calcularDistancia(
            parseFloat(latitude),
            parseFloat(longitude),
            DESTINO.lat,
            DESTINO.lon
          );

          if (CONFIG.DEBUG_MODE) {
            console.log(`ℹ️ ${placa} - Distância: ${distancia.toFixed(3)} km`);
          }

          if (distancia <= CONFIG.RAIO_DETECCAO_KM) {
            this.caminhoesNotificados.add(placa);
            await this.enviarNotificacao(placa, distancia);
          }
        }
      }
    } catch (error) {
      console.error('Erro no monitoramento:', error.message);
    }
  }
}

// =============================================
// INICIALIZAÇÃO DO SISTEMA
// =============================================
async function iniciarSistema() {
  console.log('\n=== SISTEMA DE MONITORAMENTO SMARTGPS ===');
  console.log(`📍 Destino: ${DESTINO.lat}, ${DESTINO.lon}`);
  console.log(`🕒 Intervalo: ${CONFIG.INTERVALO_MINUTOS} minuto(s)`);
  console.log(`🔎 Raio: ${CONFIG.RAIO_DETECCAO_KM} km`);
  console.log('=========================================');

  const monitor = new SmartGPSMonitor();

  try {
    // Primeira verificação imediata
    await monitor.monitorar();
    
    // Configura intervalo periódico
    const intervalo = setInterval(
      () => monitor.monitorar(),
      CONFIG.INTERVALO_MINUTOS * 60 * 1000
    );

    // Encerramento elegante
    process.on('SIGINT', () => {
      clearInterval(intervalo);
      console.log('\n🛑 Monitoramento encerrado');
      process.exit(0);
    });

  } catch (error) {
    console.error('\n⛔ Falha na inicialização:', error.message);
    process.exit(1);
  }
}

// Inicia a aplicação
iniciarSistema();