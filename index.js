const express = require('express');
require('dotenv').config();
const axios = require('axios');
const mongoose = require('mongoose');

const app = express();
app.use(express.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'farmer_app_token_2026';
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID || '1307599989103567';
const MONGODB_URI = process.env.MONGODB_URI;
const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL;
const FLOW_ID = process.env.FLOW_ID; // <--- Your Flow ID goes in Render Environment Variables

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

// --- Google Apps Script Save Function ---
async function saveToSheet(phone, data) {
  if (!APPS_SCRIPT_URL) return console.log('No Apps Script URL set, skipping save.');
  try {
    console.log('SENDING TO SHEET:', JSON.stringify(data)); 
    await axios.post(APPS_SCRIPT_URL, {
      phone: phone,
      name: data.name || '',
      id: data.id || '',
      manager: data.manager || '',
      permit: data.permit || '',
      contact: data.contact || '',
      email: data.email || '',
      gps: data.gps || '',
      province: data.province || '',
      district: data.district || '',
      municipality: data.municipality || '',
      farmSize: data.farmSize || '',
      hempAmount: data.hempAmount || '',
      plotLat: data.plot?.lat || '',
      plotLong: data.plot?.long || '',
      plotArea: data.plot?.area || ''
    });
    console.log('✅ SAVED TO SHEET via Apps Script!');
  } catch (e) {
    console.error('Sheet save failed:', e.message);
  }
}

// --- Send Standard WhatsApp Message ---
async function sendWhatsApp(to, text) {
  try {
    const url = `https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`;
    await axios.post(url, { messaging_product: 'whatsapp', to: to, text: { body: text } }, {
      headers: { 'Authorization': `Bearer ${WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' }
    });
    console.log('Sent OK');
  } catch (e) { console.error('Send failed:', e.response?.data || e.message); }
}

// --- Send WhatsApp Flow (NEW) ---
async function sendWhatsAppFlow(to, flowId) {
  try {
    const url = `https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`;
    await axios.post(url, {
      messaging_product: 'whatsapp',
      to: to,
      type: 'interactive',
      interactive: {
        type: 'flow',
        body: { text: 'Please fill in your farm registration details below:' },
        action: {
          name: 'flow',
          parameters: {
            flow_message_version: '3',
            flow_id: flowId,
            flow_cta: 'Register Now',
            flow_action: 'navigate',
            flow_action_payload: {
              screen: 'WELCOME', // Make sure this matches your Flow's JSON
              data: {}
            }
          }
        }
      }
    }, {
      headers: { 'Authorization': `Bearer ${WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' }
    });
    console.log('Flow sent successfully');
  } catch (e) {
    console.error('Flow send failed:', e.response?.data || e.message);
  }
}

// --- Webhook Routes ---
app.get('/', (req,res) => res.send('Farmer Bot Live'));
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

  // --- NEW: Handle WhatsApp Flow Submission ---
  if (msg.type === 'interactive' && msg.interactive?.type === 'nfm_reply') {
    console.log('=== FLOW SUBMITTED ===');
    try {
      const flowData = JSON.parse(msg.interactive.nfm_reply.response_json);
      console.log('Flow Data Received:', flowData);

      let farmer = await Farmer.findOne({ phone: from });
      if (!farmer) { farmer = new Farmer({ phone: from, state: 'idle', data: {} }); }

      // Map Flow JSON fields to your MongoDB/Sheet fields
      farmer.data = {
        name: flowData.full_name || '',
        id: flowData.id_number || '',
        manager: flowData.farm_manager || '',
        permit: flowData.permit_number || '',
        contact: flowData.contact_number || '',
        email: flowData.email || '',
        gps: flowData.gps_location || '',
        province: flowData.province || '',
        district: flowData.district || '',
        municipality: flowData.municipality || '',
        farmSize: flowData.farm_size || '',
        hempAmount: flowData.hemp_allocated || '',
      };
      
      farmer.state = 'idle';
      farmer.markModified('data');
      await farmer.save();

      await saveToSheet(from, farmer.data);
      await sendWhatsApp(from, '✅ Thank you! Your registration is complete and has been saved.');
      
    } catch (e) {
      console.error('Error parsing Flow reply:', e.message);
      await sendWhatsApp(from, 'There was an error saving your form. Please try again.');
    }
    return; // Stop processing further text logic
  }

  // --- Standard Text Message Logic ---
  const text = (msg.text?.body || '').trim();
  let farmer = await Farmer.findOne({ phone: from });
  if (!farmer) { farmer = new Farmer({ phone: from, state: 'idle', data: {} }); }

  let reply = '';

  if (farmer.state === 'idle') {
    if (['hi', 'hello', 'register'].includes(text.toLowerCase())) {
      if (FLOW_ID) {
        farmer.state = 'flow_pending';
        await sendWhatsAppFlow(from, FLOW_ID);
        reply = ''; // No text reply, the Flow button is the message
      } else {
        // Fallback if Flow ID isn't set yet
        farmer.state = 'profile_name'; farmer.data = {};
        reply = 'Welcome to Ukumilaweuthu! 🌾\n\n1. What is your FULL NAME?';
      }
    } else {
      reply = 'Welcome! Type "Register" to start.';
    }
  } 
  else if (farmer.state === 'flow_pending') {
    reply = 'Please complete the registration form that was sent to you. If you don\'t see it, type "Register" again.';
  }
  // --- Text Fallback (In case Flow fails or is not used) ---
  else if (farmer.state === 'profile_name') {
    farmer.data.name = text; farmer.markModified('data'); farmer.state = 'profile_id';
    reply = `Thanks ${text}!\n\n2. ID Number?`;
  }
  else if (farmer.state === 'profile_id') {
    farmer.data.id = text; farmer.markModified('data'); farmer.state = 'profile_manager';
    reply = '3. Name of Farm Manager/Supervisor?';
  }
  else if (farmer.state === 'profile_manager') {
    farmer.data.manager = text; farmer.markModified('data'); farmer.state = 'profile_permit';
    reply = '4. Hemp Permit Number?';
  }
  else if (farmer.state === 'profile_permit') {
    farmer.data.permit = text; farmer.markModified('data'); farmer.state = 'profile_contact';
    reply = '5. Contact Number?';
  }
  else if (farmer.state === 'profile_contact') {
    farmer.data.contact = text; farmer.markModified('data'); farmer.state = 'profile_email';
    reply = '6. Email?';
  }
  else if (farmer.state === 'profile_email') {
    farmer.data.email = text; farmer.markModified('data'); farmer.state = 'profile_gps';
    reply = '7. Farm GPS Coordinates? (e.g. -25.123, 27.456)';
  }
  else if (farmer.state === 'profile_gps') {
    farmer.data.gps = text; farmer.markModified('data'); farmer.state = 'profile_province';
    reply = '8. Province?';
  }
  else if (farmer.state === 'profile_province') {
    farmer.data.province = text; farmer.markModified('data'); farmer.state = 'profile_district';
    reply = '9. District?';
  }
  else if (farmer.state === 'profile_district') {
    farmer.data.district = text; farmer.markModified('data'); farmer.state = 'profile_municipality';
    reply = '10. Municipality?';
  }
  else if (farmer.state === 'profile_municipality') {
    farmer.data.municipality = text; farmer.markModified('data'); farmer.state = 'profile_size';
    reply = '11. Farm Size (ha)?';
  }
  else if (farmer.state === 'profile_size') {
    farmer.data.farmSize = text; farmer.markModified('data'); farmer.state = 'profile_hemp';
    reply = '12. Amount allocated to hemp 2026/27 season (ha)?';
  }
  else if (farmer.state === 'profile_hemp') {
    farmer.data.hempAmount = text; farmer.markModified('data'); farmer.state = 'ask_plot';
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
    farmer.data.plot = { lat: text }; farmer.markModified('data'); farmer.state = 'plot_long';
    reply = 'Enter Plot Longitude*:';
  }
  else if (farmer.state === 'plot_long') {
    farmer.data.plot.long = text; farmer.markModified('data'); farmer.state = 'plot_area';
    reply = 'Enter Plot Area (ha):';
  }
  else if (farmer.state === 'plot_area') {
    farmer.data.plot.area = text; farmer.markModified('data');
    await saveToSheet(from, farmer.data);
    farmer.state = 'idle';
    reply = `✅ Plot saved! Your full registration is complete.`;
  }

  await farmer.save();
  if (reply) await sendWhatsApp(from, reply); // Only send if there is a text reply
});

app.listen(process.env.PORT || 10000, () => console.log('Server running on port ' + (process.env.PORT || 10000)));