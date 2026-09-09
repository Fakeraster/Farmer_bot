const express = require('express');
require('dotenv').config();
const axios = require('axios');

const app = express();
app.use(express.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'farmer_app_token_2026';
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID || '1307599989103567';

let farmers = {};

async function sendWhatsApp(to, text) {
  if (!WHATSAPP_TOKEN) {
    console.log('[NO TOKEN] Would send to', to, ':', text);
    return;
  }
  try {
    const url = `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`;
    const res = await axios.post(url, {
      messaging_product: 'whatsapp',
      to: to,
      text: { body: text }
    }, {
      headers: {
        'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    console.log('Sent OK:', res.data);
  } catch (e) {
    console.error('Send failed:', e.response?.data || e.message);
  }
}

app.get('/', (req,res) => res.send('Farmer Bot Live - OK'));

app.get('/webhook', (req,res) => {
  if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === VERIFY_TOKEN) {
    console.log('WEBHOOK_VERIFIED');
    return res.status(200).send(req.query['hub.challenge']);
  }
  res.sendStatus(403);
});

app.post('/webhook', async (req,res) => {
  const msg = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (!msg) return res.sendStatus(200);
  const from = msg.from;
  const text = (msg.text?.body || '').trim();
  console.log(`IN from ${from}: ${text}`);

  let farmer = farmers[from] || { step: 0, data: {} };
  let reply = '';

  if (farmer.step === 0) {
    farmers[from] = { step: 1, data: {} };
    reply = 'Welcome to TUSA! 🌾\n\nLets register you.\n1. What is your FULL NAME?';
  } else if (farmer.step === 1) {
    farmer.data.name = text; farmer.step = 2; farmers[from]=farmer;
    reply = `Thanks ${text}\n2. ID Number?`;
  } else if (farmer.step === 2) {
    farmer.data.id = text; farmer.step = 3; farmers[from]=farmer;
    reply = '3. Farm LOCATION?';
  } else if (farmer.step === 3) {
    farmer.data.location = text; farmer.step = 4; farmers[from]=farmer;
    reply = '4. Farm SIZE in ha? e.g. 2';
  } else if (farmer.step === 4) {
    farmer.data.size = text; farmer.step = 5; farmers[from]=farmer;
    reply = '5. MAIN CROP? e.g. maize';
  } else if (farmer.step === 5) {
    farmer.data.crop = text;
    console.log('=== REGISTERED ===', farmer.data);
    reply = `✅ DONE ${farmer.data.name}! ${farmer.data.location}, ${farmer.data.size}ha ${farmer.data.crop}. We will call you.`;
    delete farmers[from];
  }

  await sendWhatsApp(from, reply);
  res.sendStatus(200);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
