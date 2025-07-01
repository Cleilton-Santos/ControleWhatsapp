// utils/geo.js
const EARTH_RADIUS_KM = 6371;
const DEGREES_TO_RADIANS = Math.PI / 180;

function calcularDistancia(lat1, lon1, lat2, lon2) {
  // Validação básica (opcional, mas recomendado)
  if (![lat1, lon1, lat2, lon2].every(coord => typeof coord === 'number')) {
    throw new Error('Coordenadas devem ser números');
  }

  // Converter graus para radianos (otimizado)
  const φ1 = lat1 * DEGREES_TO_RADIANS;
  const φ2 = lat2 * DEGREES_TO_RADIANS;
  const Δφ = (lat2 - lat1) * DEGREES_TO_RADIANS;
  const Δλ = (lon2 - lon1) * DEGREES_TO_RADIANS;

  // Fórmula de Haversine (parte central)
  const a = 
    Math.sin(Δφ / 2) ** 2 + 
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return EARTH_RADIUS_KM * c;
}

module.exports = { calcularDistancia };