require('dotenv').config();
const axios = require('axios');
const twilio = require('twilio');

const API_URL = process.env.SMARTGPS_API_URL;
const EMAIL = process.env.SMARTGPS_EMAIL;
const PASSWORD = process.env.SMARTGPS_PASSWORD;

const TWILIO_SID = process.env.TWILIO_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_WHATSAPP_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER;
const WHATSAPP_NUMBER = process.env.WHATSAPP_NUMBER;

const client = new twilio(TWILIO_SID, TWILIO_AUTH_TOKEN);

// Lista para armazenar caminhões já notificados
let caminhoneirosNotificados = {};

// Função para fazer login e obter o token
async function obterToken() {
    try {
        const response = await axios.post(`${API_URL}/login`, null, {
            headers: { "Content-Type": "multipart/form-data" },
            params: { email: EMAIL, password: PASSWORD }
        });

        if (response.data.status === 1) {
            console.log("✅ Token obtido!");
            return response.data.user_api_hash;
        } else {
            console.error("❌ Erro no login: Credenciais inválidas");
            return null;
        }
    } catch (error) {
        console.error("❌ Erro ao obter token:", error.message);
        return null;
    }
}

// Função para buscar caminhões autenticado
async function buscarCaminhoes(token) {
    try {
        const response = await axios.get(`${API_URL}/caminhoes`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        return response.data; // Retorna os caminhões
    } catch (error) {
        console.error("❌ Erro ao buscar caminhões:", error.message);
        return [];
    }
}

// Verifica se um caminhão chegou ao destino
function verificarLocalizacao(lat, lon, local) {
    const distancia = Math.sqrt((lat - local.lat) ** 2 + (lon - local.lon) ** 2);
    return distancia < 0.01; // Se estiver muito próximo da localidade
}

// Função principal para verificar chegada dos caminhões
async function verificarChegada() {
    const token = await obterToken();
    if (!token) return;

    const caminhoes = await buscarCaminhoes(token);
    const LOCALIDADE_DESEJADA = { lat: -10.94026, lon: -37.08845 }; //Garagem FM

    caminhoes.forEach(caminhao => {
        const { placa, latitude, longitude } = caminhao;
        const chegou = verificarLocalizacao(latitude, longitude, LOCALIDADE_DESEJADA);

        if (chegou && !caminhoneirosNotificados[placa]) {
            const horario = new Date().toLocaleTimeString();
            console.log(`🚛 Caminhão ${placa} chegou às ${horario}`);
            caminhoneirosNotificados[placa] = horario;

            enviarMensagemWhatsApp(placa, horario);
        }
    });
}

// Função para enviar mensagem via WhatsApp
async function enviarMensagemWhatsApp(placa, horario) {
    const mensagem = `🚛 Caminhão ${placa} chegou às ${horario}`;

    try {
        await client.messages.create({
            from: TWILIO_WHATSAPP_NUMBER,
            to: WHATSAPP_NUMBER,
            body: mensagem
        });
        console.log(`📲 Mensagem enviada para WhatsApp: ${mensagem}`);
    } catch (error) {
        console.error("❌ Erro ao enviar WhatsApp:", error.message);
    }
}

// Rodar a verificação a cada 1 minuto
setInterval(verificarChegada, 60000);
