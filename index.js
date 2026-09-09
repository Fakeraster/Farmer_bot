const express = require('express');
require('dotenv').config();
const axios = require('axios');
const { google } = require('googleapis');
const mongoose = require('mongoose');

const app = express();
app.use(express.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'farmer_app_token_2026';
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID || '1307599989103567';
const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const GOOGLE_CREDS = process.env.GOOGLE_CREDS_JSON;
const MONGODB_URI = process.env.MONGODB_URI;

// --- MongoDB Setup ---
const farmerSchema = new mongoose.Schema({
  phone: String,
  state: String, 
  data: { type: Object, default: {} }
});
const Farmer = mongoose.model('Farmer', farmerSchema);

async function connectDB() {
  if (!MONGODB_URI) return console.log('Skipping MongoDB.');
  try { await mongoose.connect(MONGODB_URI); console.log('MongoDB Connected!'); }
  catch (err) { console.error('MongoDB error:', err.message); }
}
connectDB();

// --- Google Sheets Save (FULL ROW) ---
async function saveToSheet(phone, data) {
  if (!SHEET_ID || !GOOGLE_CREDS) return console.log('No Sheet config, skipping save.');
  try {
    const creds = JSON.parse(GOOGLE_CREDS);
    const auth = new google.auth.GoogleAuth({ credentials: creds, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
    const sheets = google.sheets({ version: 'v4', auth });
    const now = new Date().toISOString();
    
    const row = [
      now, phone, data.name || '', data.id || '', data.manager || '', data.permit || '', 
      data.contact || '', data.email || '', data.gps || '', data.province || '', 
      data.district || '', data.municipality || '', data.farmSize || '', data.hempAmount || '', 
      data.plot?.lat || '', data.plot?.long || '', data.plot?.area || ''
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: 'Sheet1!A:Q', // Matches the 17 columns
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [row] }
    });
    console.log('SAVED TO SHEET:', row);
  } catch (e) { console.error('Sheet save failed:', e.message); }
}

async function sendWhatsApp(to, text) {
  try {
    const url = `https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`;
    await axios.post(url, { messaging_product: 'whatsapp', to: to, text: { body: text } }, {
      headers: { 'Authorization': `Bearer ${WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' }
    });
    console.log('Sent OK');
  } catch (e) { console.error('Send failed:', e.response?.data || e.message); }
}

app.get('/', (req,res) => res.send('Farmer Bot Live - Full Workbook'));
app.get('/webhook', (req,res) => {
  if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === VERIFY_TOKEN) {
    return res.status(200).send(req.query['hub.challenge']);
  }
  res.sendStatus(403);
});

app.post('/webhook', async (req,res) => {
  res.sendStatus(200);
  const msg = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (!msg) return;
  const from = msg.from;
  const text = (msg.text?.body || '').trim();

  let farmer = await Farmer.findOne({ phone: from });
  if (!farmer) { farmer = new Farmer({ phone: from, state: 'idle', data: {} }); }

  let reply = '';

  if (farmer.state === 'idle') {
    if (['hi', 'hello', 'register'].includes(text.toLowerCase())) {
      farmer.state = 'profile_name'; farmer.data = {};
      reply = 'Welcome to Ukumilaweuthu! 🌾\n\nWe need to capture your full farm profile.\n\n1. What is your FULL NAME?';
    } else reply = 'Welcome! Type "Register" to start.';
  }
  else if (farmer.state === 'profile_name') {
    farmer.data.name = text; farmer.state = 'profile_id';
    reply = `Thanks ${text}!\n\n2. ID Number?`;
  }
  else if (farmer.state === 'profile_id') {
    farmer.data.id = text; farmer.state = 'profile_manager';
    reply = '3. Name of Farm Manager/Supervisor?';
  }
  else if (farmer.state === 'profile_manager') {
    farmer.data.manager = text; farmer.state = 'profile_permit';
    reply = '4. Hemp Permit Number?';
  }
  else if (farmer.state === 'profile_permit') {
    farmer.data.permit = text; farmer.state = 'profile_contact';
    reply = '5. Contact Number?';
  }
  else if (farmer.state === 'profile_contact') {
    farmer.data.contact = text; farmer.state = 'profile_email';
    reply = '6. Email?';
  }
  else if (farmer.state === 'profile_email') {
    farmer.data.email = text; farmer.state = 'profile_gps';
    reply = '7. Farm GPS Coordinates? (e.g. -25.123, 27.456)';
  }
  else if (farmer.state === 'profile_gps') {
    farmer.data.gps = text; farmer.state = 'profile_province';
    reply = '8. Province?';
  }
  else if (farmer.state === 'profile_province') {
    farmer.data.province = text; farmer.state = 'profile_district';
    reply = '9. District?';
  }
  else if (farmer.state === 'profile_district') {
    farmer.data.district = text; farmer.state = 'profile_municipality';
    reply = '10. Municipality?';
  }
  else if (farmer.state === 'profile_municipality') {
    farmer.data.municipality = text; farmer.state = 'profile_size';
    reply = '11. Farm Size (ha)?';
  }
  else if (farmer.state === 'profile_size') {
    farmer.data.farmSize = text; farmer.state = 'profile_hemp';
    reply = '12. Amount allocated to hemp 2026/27 season (ha)?';
  }
  else if (farmer.state === 'profile_hemp') {
    farmer.data.hempAmount = text; farmer.state = 'ask_plot';
    reply = `✅ Profile saved!\n\nWould you like to add Plot details (GPS, Area)?\nType "Yes" or "No".`;
  }
  else if (farmer.state === 'ask_plot') {
    if (text.toLowerCase() === 'yes') {
      farmer.state = 'plot_lat';
      reply = 'Enter Plot Latitude* (Check phone GPS):';
    } else {
      await saveToSheet(from, farmer.data);
      farmer.state = 'idle';
      reply = 'No problem! Your registration is complete. Type "Hi" if you need anything else.';
    }
  }
  else if (farmer.state === 'plot_lat') {
    farmer.data.plot = { lat: text }; farmer.state = 'plot_long';
    reply = 'Enter Plot Longitude*:';
  }
  else if (farmer.state === 'plot_long') {
    farmer.data.plot.long = text; farmer.state = 'plot_area';
    reply = 'Enter Plot Area (ha):';
  }
  else if (farmer.state === 'plot_area') {
    farmer.data.plot.area = text;
    await saveToSheet(from, farmer.data);
    farmer.state = 'idle';
    reply = `✅ Plot saved! Your full registration is complete.`;
  }

  await farmer.save();
  await sendWhatsApp(from, reply);
});

app.listen(process.env.PORT || 10000, () => console.log('Server running on port ' + (process.env.PORT || 10000)));