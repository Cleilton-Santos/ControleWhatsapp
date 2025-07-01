require('dotenv').config();
const twilio = require('twilio');

const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);

const mensagem = '🚚 Teste de envio manual via WhatsApp (ControleWhatsapp)!';

client.messages
  .create({
    from: process.env.TWILIO_WHATSAPP_NUMBER,
    to: process.env.WHATSAPP_NUMBER,
    body: mensagem,
  })
  .then(message => {
    console.log('Mensagem enviada com sucesso! SID:', message.sid);
  })
  .catch(error => {
    console.error('Erro ao enviar mensagem:', error.message);
  });