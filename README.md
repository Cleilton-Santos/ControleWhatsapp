# 🚛 Controle de Monitoramento de Caminhões com WhatsApp (SmartGPS + Twilio)

Este projeto monitora caminhões utilizando a API da plataforma SmartGPS e envia alertas via WhatsApp usando o Twilio quando veículos entram em um raio de proximidade definido para uma localidade.

---

## 📦 Funcionalidades

- 🔍 Monitora veículos em tempo real via API da SmartGPS
- 📍 Calcula distância do caminhão até o ponto de destino
- 📤 Envia notificação via WhatsApp quando o caminhão está dentro do raio
- 🔁 Monitoramento periódico a cada X minutos (configurável)
- 🔧 Arquitetura modular (API, WhatsApp, geolocalização)

---

## 📁 Estrutura do Projeto

```
ChargingControl/
├── src/
│   ├── index.js                 # Início do sistema
│   ├── monitor.js               # Lógica principal de monitoramento
│   ├── services/
│   │   ├── gpsService.js        # API da SmartGPS (login e veículos)
│   │   └── whatsappService.js   # Integração com Twilio WhatsApp
│   └── utils/
│       └── geo.js               # Cálculo de distância geográfica
├── .env                         # Variáveis de ambiente (não subir no Git)
├── testSend.js                 # Teste manual de envio de mensagem
└── README.md                   # Este arquivo
```

---

## ⚙️ Como usar

### 1. Instale as dependências

```bash
npm install
```

### 2. Configure o `.env`

Crie um arquivo `.env` na raiz com:

```env
SMARTGPS_ENDPOINTS=https://sp-beta.tracker-net.app/api
SMARTGPS_EMAIL=seu_email
SMARTGPS_PASSWORD=sua_senha

TWILIO_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=seu_token_twilio
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
WHATSAPP_NUMBER=whatsapp:+55SEUNUMERO

DESTINO_LAT=-10.94026
DESTINO_LON=-37.08845

DEBUG=true
RAIO_DETECCAO_KM=0.2
INTERVALO_MINUTOS=1
```

### 3. Inicie o monitoramento

```bash
node src/index.js
```

---

## 🧪 Teste rápido de envio de WhatsApp

Para testar o envio manual de mensagem:

```bash
node testSend.js
```

---

## 🛠️ Requisitos

- Node.js 18+
- Conta Twilio com WhatsApp Sandbox habilitado
- Acesso à API da plataforma SmartGPS / TrackerNet

---

## 🛡️ Observações

- O Twilio Sandbox tem limite de **9 mensagens por dia**
- O `.env` nunca deve ser enviado para repositórios públicos

---

## ✨ Autor

Desenvolvido com 💻 por Cleilton-Santos

