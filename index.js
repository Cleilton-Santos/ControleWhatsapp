require('dotenv').config();
//console.log("SMARTGPS_API_URL:", process.env.SMARTGPS_API_URL);
//console.log("SMARTGPS_API_KEY:", process.env.SMARTGPS_API_KEY);

const axios = require('axios');
const twilio = require('twilio');

const API_URL = process.env.SMARTGPS_API_URL;
const API_KEY = process.env.SMARTGPS_API_KEY;
const WHATSAPP_NUMBER = process.env.WHATSAPP_NUMBER;
const TWILIO_SID = process.env.TWILIO_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_WHATSAPP_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER;

const client = new twilio(TWILIO_SID, TWILIO_AUTH_TOKEN);

// Lista para armazenar caminhões que já chegaram
let caminhoneirosNotificados = {};

async function buscarCaminhoes() {
    try {
        const response = await axios.get(`${API_URL}/caminhoes`, {
            headers: { 'Authorization': `Bearer ${API_KEY}` }
        });

        const caminhoes = response.data; // Supondo que a resposta seja um array de caminhões
        return caminhoes;
    } catch (error) {
        console.error("Erro ao buscar caminhões:", error.message);
        return [];
    }
}

async function verificarChegada() {
    const caminhoes = await buscarCaminhoes();
    const LOCALIDADE_DESEJADA = { lat: -10.94026, lon: -37.08845 };//Garagem FM

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

function verificarLocalizacao(lat, lon, local) {
    const distancia = Math.sqrt((lat - local.lat) ** 2 + (lon - local.lon) ** 2);
    return distancia < 0.01; // Se estiver próximo do local desejado
}

async function enviarMensagemWhatsApp(placa, horario) {
    const mensagem = `🚛 Caminhão ${placa} chegou às ${horario}`;
    
    try {
        await client.messages.create({
            from: TWILIO_WHATSAPP_NUMBER,
            to: `whatsapp:${WHATSAPP_NUMBER}`,
            body: mensagem
        });
        console.log(`📲 Mensagem enviada para WhatsApp: ${mensagem}`);
    } catch (error) {
        console.error("Erro ao enviar WhatsApp:", error.message);
    }
}

// Rodar a verificação a cada 1 minuto
setInterval(verificarChegada, 60000);
 