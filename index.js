// Adicione isso no TOPO do seu index.js (apenas para teste)
// Temporariamente, teste com uma API mock
process.env.SMARTGPS_API_URL = "https://api.smartgps.com.br/v1";
process.env.SMARTGPS_EMAIL = "monitoramento";
process.env.SMARTGPS_PASSWORD = "toninho1";
process.env.TWILIO_SID = "ACfde1e0bf04c1687a397855d2aaad7e6d";
process.env.TWILIO_AUTH_TOKEN = "860618586da7fd20c6cf792a7721b1ef";
process.env.TWILIO_WHATSAPP_NUMBER = "whatsapp:+14302094074";
process.env.WHATSAPP_NUMBER = "whatsapp:+5579999130957";
process.env.DESTINO_LAT = "-10.94026";
process.env.DESTINO_LON = "-37.08845";

require('dotenv').config({ path: '.env' }); // Carrega explicitamente do arquivo .env
const axios = require('axios');
const twilio = require('twilio');
const FormData = require('form-data');

// =============================================
// VERIFICAÇÃO DAS VARIÁVEIS DE AMBIENTE
// =============================================
const requiredVariables = [
    'SMARTGPS_API_URL',
    'SMARTGPS_EMAIL',
    'SMARTGPS_PASSWORD',
    'TWILIO_SID',
    'TWILIO_AUTH_TOKEN',
    'WHATSAPP_NUMBER',
    'DESTINO_LAT',
    'DESTINO_LON'
];

// Verifica cada variável e mostra qual está faltando
let todasVariaveisPresentes = true;
requiredVariables.forEach(varName => {
    if (!process.env[varName]) {
        console.error(`❌ Variável de ambiente faltando: ${varName}`);
        todasVariaveisPresentes = false;
    } else if (varName.includes('PASSWORD') || varName.includes('AUTH_TOKEN')) {
        console.log(`✅ ${varName}: ********** (${process.env[varName].length} caracteres)`);
    } else {
        console.log(`✅ ${varName}: ${process.env[varName]}`);
    }
});

if (!todasVariaveisPresentes) {
    console.error('\n⛔ ERRO CRÍTICO: Variáveis de ambiente necessárias não foram configuradas');
    console.error('Por favor, crie um arquivo .env na raiz do projeto com essas variáveis');
    process.exit(1);
}

console.log('\n🔧 Todas variáveis de ambiente estão configuradas corretamente\n');

// =============================================
// CONFIGURAÇÕES DO SISTEMA
// =============================================
const {
    SMARTGPS_API_URL,
    SMARTGPS_EMAIL,
    SMARTGPS_PASSWORD,
    TWILIO_SID,
    TWILIO_AUTH_TOKEN,
    TWILIO_WHATSAPP_NUMBER,
    WHATSAPP_NUMBER,
    DESTINO_LAT,
    DESTINO_LON
} = process.env;

const DESTINO = {
    lat: parseFloat(DESTINO_LAT),
    lon: parseFloat(DESTINO_LON)
};
const RAIO_DETECCAO_KM = 0.2; // 200 metros
const INTERVALO_MINUTOS = 1;

// =============================================
// INICIALIZAÇÃO DO TWILIO
// =============================================
const client = new twilio(TWILIO_SID, TWILIO_AUTH_TOKEN);

// =============================================
// ESTADO DA APLICAÇÃO
// =============================================
let userApiToken = null;
const caminhoesNotificados = new Set();

// =============================================
// FUNÇÕES PRINCIPAIS
// =============================================

async function fazerLogin() {
    try {
        const response = await axios.post(`${SMARTGPS_API_URL}/auth/login`, {
            username: SMARTGPS_EMAIL,  // Note que pode ser 'username' ao invés de 'email'
            password: SMARTGPS_PASSWORD
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        return response.data.token;  // O campo pode ser 'token' ao invés de 'user_api_hash'
    } catch (error) {
        console.error('Erro login:', error.response?.data);
        return null;
    }
}

function calcularDistancia(lat1, lon1, lat2, lon2) {
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
    return R * c; // Distância em km
}

async function buscarCaminhoes() {
    try {
        const response = await axios.get(`${SMARTGPS_API_URL}/veiculos`, {
            headers: {
                'Authorization': `Bearer ${userApiToken}`
            },
            params: {
                status: 'ativos'
            }
        });
        return response.data.veiculos; // A estrutura real pode retornar um objeto com propriedade 'veiculos'
    } catch (error) {
        console.error('Erro veículos:', error.response?.data);
        return [];
    }
}

async function enviarAlerta(placa) {
    const horario = new Date().toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    
    const mensagem = `🚨 *ALERTA DE CHEGADA* 🚨\n\n` +
                   `*Caminhão:* ${placa}\n` +
                   `*Horário:* ${horario}\n` +
                   `*Local:* Garagem FM\n` +
                   `*Coordenadas:* ${DESTINO.lat.toFixed(5)}, ${DESTINO.lon.toFixed(5)}`;

    try {
        await client.messages.create({
            body: mensagem,
            from: TWILIO_WHATSAPP_NUMBER,
            to: WHATSAPP_NUMBER
        });
        console.log(`📲 Notificação enviada para ${WHATSAPP_NUMBER}`);
    } catch (error) {
        console.error('❌ Falha ao enviar WhatsApp:', error.message);
    }
}

async function monitorarChegadas() {
    console.log('\n🔍 Iniciando monitoramento de caminhões...');
    const caminhoes = await buscarCaminhoes();

    if (caminhoes.length === 0) {
        console.log('ℹ️ Nenhum caminhão encontrado na consulta atual');
        return;
    }

    for (const caminhao of caminhoes) {
        try {
            const { placa, latitude, longitude } = caminhao;
            
            if (!caminhoesNotificados.has(placa)) {
                const distancia = calcularDistancia(
                    parseFloat(latitude),
                    parseFloat(longitude),
                    DESTINO.lat,
                    DESTINO.lon
                );

                console.log(`ℹ️ ${placa} - Distância: ${distancia.toFixed(3)} km`);

                if (distancia <= RAIO_DETECCAO_KM) {
                    console.log(`🚛 CHEGOU: ${placa} (${distancia.toFixed(2)} km)`);
                    caminhoesNotificados.add(placa);
                    await enviarAlerta(placa);
                }
            }
        } catch (error) {
            console.error(`⚠️ Erro ao processar caminhão ${caminhao.placa}:`, error.message);
        }
    }
}

// =============================================
// INICIALIZAÇÃO DO SISTEMA
// =============================================
function iniciarSistema() {
    console.log('\n=========================================');
    console.log('   SISTEMA DE MONITORAMENTO DE CAMINHÕES');
    console.log('=========================================');
    
    // Verificação inicial das coordenadas
    console.log('\n📍 Configuração de localização:');
    console.log(`Latitude: ${DESTINO.lat}`);
    console.log(`Longitude: ${DESTINO.lon}`);
    console.log(`Raio de detecção: ${RAIO_DETECCAO_KM} km`);

    // Executa imediatamente e depois no intervalo definido
    monitorarChegadas();
    setInterval(monitorarChegadas, INTERVALO_MINUTOS * 60 * 1000);

    console.log(`\n🟢 Monitoramento ativo (verificando a cada ${INTERVALO_MINUTOS} minuto(s))`);
    console.log('=========================================\n');
}

iniciarSistema();