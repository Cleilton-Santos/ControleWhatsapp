const { autenticar, buscarVeiculos } = require('./services/gpsService');
const { enviarNotificacao } = require('./services/whatsappService');
const { calcularDistancia } = require('./utils/geo');

class SmartGPSMonitor {
  constructor(config, destino) {
    this.config = config;
    this.destino = destino;
    this.tokenCache = { value: null, expiresAt: null, endpoint: null };
    this.caminhoesNotificados = new Set();
  }

  // Adicione esta nova função para verificar horário
  isHorarioComercial() {
    const agora = new Date();
    const hora = agora.getHours();
    const diaDaSemana = agora.getDay(); // 0=Domingo, 1=Segunda...
    
    // Configurações de horário (personalizável)
    const HORARIO_ABERTURA = 8;  // 8h
    const HORARIO_FECHAMENTO = 18; // 18h
    const DIAS_UTEIS = [1, 2, 3, 4, 5]; // Segunda a Sexta

    return DIAS_UTEIS.includes(diaDaSemana) && 
           hora >= HORARIO_ABERTURA && 
           hora < HORARIO_FECHAMENTO;
  }

  async encontrarEndpointAtivo() {
    for (const endpoint of this.config.ENDPOINTS) {
      try {
        const token = await autenticar(endpoint, process.env.SMARTGPS_EMAIL, process.env.SMARTGPS_PASSWORD);
        this.tokenCache = {
          value: token,
          expiresAt: new Date(Date.now() + 55 * 60 * 1000),
          endpoint
        };
        console.log(`🟢 Endpoint ativo: ${endpoint}`);
        return;
      } catch {
        if (this.config.DEBUG_MODE) {
          console.error(`🔴 Falha no endpoint: ${endpoint}`);
        }
      }
    }
    throw new Error('Todos os endpoints falharam');
  }

  async monitorar() {
    try {
      if (!this.tokenCache.value || new Date() > this.tokenCache.expiresAt) {
        await this.encontrarEndpointAtivo();
      }

      const veiculos = await buscarVeiculos(this.tokenCache.endpoint, this.tokenCache.value);
      for (const veiculo of veiculos) {
        const placa = veiculo.name;
        const latitude = veiculo.lat;
        const longitude = veiculo.lng;

        if (!latitude || !longitude || this.caminhoesNotificados.has(placa)) continue;

        const distancia = calcularDistancia(latitude, longitude, this.destino.lat, this.destino.lon);

        if (this.config.DEBUG_MODE) {
          console.log(`ℹ️ ${placa} - Distância: ${distancia.toFixed(3)} km`);
        }

        if (distancia <= this.config.RAIO_DETECCAO_KM) {
          // Verifica horário antes de enviar
          if (this.isHorarioComercial()) {
            this.caminhoesNotificados.add(placa);
            await enviarNotificacao(placa, distancia);
          } else if (this.config.DEBUG_MODE) {
            console.log(`⏰ ${placa} - Alerta não enviado (fora do horário comercial)`);
          }
        }
      }
    } catch (err) {
      console.error('Erro no monitoramento:', err.message);
    }
  }
}

module.exports = SmartGPSMonitor;