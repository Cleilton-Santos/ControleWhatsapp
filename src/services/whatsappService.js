const twilio = require('twilio');
const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);

async function enviarNotificacao(placa, distancia) {
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

module.exports = { enviarNotificacao };
