require('dotenv').config();
const SmartGPSMonitor = require('./monitor');

const CONFIG = {
  ENDPOINTS: process.env.SMARTGPS_ENDPOINTS?.split(',') || ['https://sp-beta.tracker-net.app/api'],
  TIMEOUT: parseInt(process.env.SMARTGPS_TIMEOUT_MS) || 15000,
  DEBUG_MODE: process.env.DEBUG === 'true',
  RAIO_DETECCAO_KM: parseFloat(process.env.RAIO_DETECCAO_KM) || 0.2,
  INTERVALO_MINUTOS: parseInt(process.env.INTERVALO_MINUTOS) || 1
};

const DESTINO = {
  lat: parseFloat(process.env.DESTINO_LAT),
  lon: parseFloat(process.env.DESTINO_LON)
};

console.log('\n=== SISTEMA DE MONITORAMENTO SMARTGPS ===');
console.log(`📍 Destino: ${DESTINO.lat}, ${DESTINO.lon}`);
console.log(`🕒 Intervalo: ${CONFIG.INTERVALO_MINUTOS} minuto(s)`);
console.log(`🔎 Raio: ${CONFIG.RAIO_DETECCAO_KM} km`);
console.log('=========================================');

const monitor = new SmartGPSMonitor(CONFIG, DESTINO);

monitor.monitorar();
setInterval(() => monitor.monitorar(), CONFIG.INTERVALO_MINUTOS * 60 * 1000);

process.on('SIGINT', () => {
  console.log('\n🛑 Monitoramento encerrado');
  process.exit(0);
});
