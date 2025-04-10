const axios = require('axios');

async function autenticar(endpoint, email, password) {
  const form = new URLSearchParams();
  form.append('email', email);
  form.append('password', password);

  const response = await axios.post(`${endpoint}/login`, form.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json'
    }
  });

  return response.data.user_api_hash;
}

async function buscarVeiculos(endpoint, token) {
  const response = await axios.get(`${endpoint}/get_devices`, {
    params: { user_api_hash: token, lang: 'pt' }
  });

  const grupos = response.data || [];
  return grupos.flatMap(grupo => grupo.items || []);
}

module.exports = { autenticar, buscarVeiculos };
