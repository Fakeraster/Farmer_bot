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
const FLOW_ID = process.env.FLOW_ID;

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

// --- Translations ---
const translations = {
  en: {
    welcome: "Welcome to Ukumilaweuthu! 🌾\n\nPlease select your language:\n1. English\n2. isiZulu\n3. Afrikaans\n4. Sesotho",
    askName: "Please type your FULL NAME to begin.",
    askId: "2. ID Number?",
    askManager: "3. Name of Farm Manager/Supervisor?",
    askPermit: "4. Hemp Permit Number?",
    askContact: "5. Contact Number?",
    askEmail: "6. Email Address?",
    askGps: "7. Farm GPS Coordinates? (e.g. -25.123, 27.456)",
    askProvince: "8. Province?",
    askDistrict: "9. District?",
    askMunicipality: "10. Municipality?",
    askFarmSize: "11. Farm Size (ha)?",
    askHemp: "12. Amount allocated to hemp 2026/27 season (ha)?",
    askCalendar: "Section 2: Production Calendar.\nPlease reply with the activities you completed and their dates.\nExample: Land prep: 10 Sep, Planting: 20 Sep, Harvest: 15 Mar",
    askPlot1: "Section 3: Field and Site Selection.\nFor PLOT 1, please provide: Latitude, Longitude, Altitude (steep/gentle/flat), Area (ha).\nExample: -25.123, 27.456, flat, 5",
    askPlot2: "For PLOT 2, please provide the same details (or type 'skip' if you only have one plot).",
    askPlot3: "For PLOT 3, please provide the same details (or type 'skip').",
    done: "✅ Thank you! Your registration and farm data have been saved.",
    invalidLang: "Invalid choice. Please reply with 1, 2, 3, or 4.",
    cancelled: "🔄 Your registration has been reset. Type 'Register' to start again."
  },
  zu: {
    welcome: "Siyakwamukela e-Ukumilaweuthu! 🌾\n\nSicela ukhethe ulimi lwakho:\n1. English\n2. isiZulu\n3. Afrikaans\n4. Sesotho",
    askName: "Sicela uthayiphe IGAMA LAKHO ELIPHELELE ukuqala.",
    askId: "2. Inombolo kamazisi?",
    askManager: "3. Igama lomphathi wepulazi?",
    askPermit: "4. Inombolo yemvume yensangu?",
    askContact: "5. Inombolo yocingo?",
    askEmail: "6. Ikheli le-imeyili?",
    askGps: "7. Izixhumanisi ze-GPS zepulazi? (e.g. -25.123, 27.456)",
    askProvince: "8. Isifundazwe?",
    askDistrict: "9. Isifunda?",
    askMunicipality: "10. Umasipala?",
    askFarmSize: "11. Usayizi wepulazi (ha)?",
    askHemp: "12. Inani elabelwe insangu 2026/27 (ha)?",
    askCalendar: "Isigaba 2: Ikhalenda Lokukhiqiza.\nSicela uphendule ngemisebenzi oyenzile kanye nezinsuku zayo.\nIsibonelo: Ukulungiswa komhlaba: 10 Sep, Ukutshala: 20 Sep",
    askPlot1: "Isigaba 3: Ukukhethwa Kwensimu.\nKwi-PLOT 1, sicela unikeze: Latitude, Longitude, Altitude (steep/gentle/flat), Area (ha).\nIsibonelo: -25.123, 27.456, flat, 5",
    askPlot2: "Kwi-PLOT 2, sicela unikeze imininingwane efanayo (noma uthayiphe 'skip').",
    askPlot3: "Kwi-PLOT 3, sicela unikeze imininingwane efanayo (noma uthayiphe 'skip').",
    done: "✅ Ngiyabonga! Ukubhalisa kwakho nedatha yepulazi kulondoloziwe.",
    invalidLang: "Ukukhetha okungalungile. Sicela uphendule ngo-1, 2, 3, noma 4.",
    cancelled: "🔄 Ukubhalisa kwakho kususwe. Thayipha 'Register' ukuqala futhi."
  },
  af: {
    welcome: "Welkom by Ukumilaweuthu! 🌾\n\nKies asseblief jou taal:\n1. English\n2. isiZulu\n3. Afrikaans\n4. Sesotho",
    askName: "Tik asseblief jou VOLLE NAAM om te begin.",
    askId: "2. ID Nommer?",
    askManager: "3. Naam van Plaasbestuurder?",
    askPermit: "4. Henning Permit Nommer?",
    askContact: "5. Kontaknommer?",
    askEmail: "6. E-pos adres?",
    askGps: "7. Plaas GPS Koördinate? (bv. -25.123, 27.456)",
    askProvince: "8. Provinsie?",
    askDistrict: "9. Distrik?",
    askMunicipality: "10. Munisipaliteit?",
    askFarmSize: "11. Plaasgrootte (ha)?",
    askHemp: "12. Hoeveelheid toegewys aan hennep 2026/27 (ha)?",
    askCalendar: "Afdeling 2: Produksiekalender.\nAntwoord asseblief met die aktiwiteite wat jy voltooi het en hul datums.\nVoorbeeld: Grondvoorbereiding: 10 Sep, Aanplanting: 20 Sep",
    askPlot1: "Afdeling 3: Perseel en Terrein Keuse.\nVir PERSEEL 1, verskaf asseblief: Latitude, Longitude, Hoogte (steil/sag/vlak), Area (ha).\nVoorbeeld: -25.123, 27.456, vlak, 5",
    askPlot2: "Vir PERSEEL 2, verskaf asseblief dieselfde besonderhede (of tik 'skip').",
    askPlot3: "Vir PERSEEL 3, verskaf asseblief dieselfde besonderhede (of tik 'skip').",
    done: "✅ Dankie! Jou registrasie en plaasdata is gestoor.",
    invalidLang: "Ongeldige keuse. Antwoord asseblief met 1, 2, 3, of 4.",
    cancelled: "🔄 Jou registrasie is herstel. Tik 'Register' om weer te begin."
  },
  st: {
    welcome: "Rea u amohela ho Ukumilaweuthu! 🌾\n\nKa kopo khetha puo ea hau:\n1. English\n2. isiZulu\n3. Afrikaans\n4. Sesotho",
    askName: "Ka kopo ngola LEBITSO LA HAO KAOFELA ho qala.",
    askId: "2. Nomoro ea ID?",
    askManager: "3. Lebitso la Mookameli oa Polasi?",
    askPermit: "4. Nomoro ea Tumello ea Hemp?",
    askContact: "5. Nomoro ea Mohala?",
    askEmail: "6. Aterese ea Imeile?",
    askGps: "7. Likhokahano tsa GPS tsa Polasi? (mohlala: -25.123, 27.456)",
    askProvince: "8. Profinse?",
    askDistrict: "9. Setereke?",
    askMunicipality: "10. Masepala?",
    askFarmSize: "11. Boholo ba Polasi (ha)?",
    askHemp: "12. Chelete e abetsoeng hemp 2026/27 (ha)?",
    askCalendar: "Karolo ea 2: Khalendara ea Tlhahiso.\nKa kopo araba ka mesebetsi eo u e qetileng le matsatsi a eona.\nMohlala: Ho lokisa mobu: 10 Sep, Ho lema: 20 Sep",
    askPlot1: "Karolo ea 3: Khetho ea Tšimo.\nBakeng sa PLOT 1, ka kopo fana ka: Latitude, Longitude, Altitude (steep/gentle/flat), Area (ha).\nMohlala: -25.123, 27.456, flat, 5",
    askPlot2: "Bakeng sa PLOT 2, ka kopo fana ka lintlha tse tšoanang (kapa ngola 'skip').",
    askPlot3: "Bakeng sa PLOT 3, ka kopo fana ka lintlha tse tšoanang (kapa ngola 'skip').",
    done: "✅ Kea leboha! Ngoliso ea hau le data ea polasi li bolokiloe.",
    invalidLang: "Khetho e fosahetseng. Ka kopo araba ka 1, 2, 3, kapa 4.",
    cancelled: "🔄 Ngoliso ea hau e hlakotsoe. Ngola 'Register' ho qala hape."
  }
};

// --- Google Apps Script Save Function ---
async function saveToSheet(phone, data) {
  if (!APPS_SCRIPT_URL) return console.log('No Apps Script URL set, skipping save.');
  try {
    console.log('SENDING TO SHEET:', JSON.stringify(data)); 
    await axios.post(APPS_SCRIPT_URL, {
      phone: phone,
      lang: data.lang || '',
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
      calendar: data.calendar || '',
      plot1: data.plot1 || '',
      plot2: data.plot2 || '',
      plot3: data.plot3 || ''
    });
    console.log('✅ SAVED TO SHEET via Apps Script!');
  } catch (e) {
    console.error('Sheet save failed:', e.message);
  }
}

// --- Send WhatsApp Text ---
async function sendWhatsApp(to, text) {
  try {
    const url = `https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`;
    await axios.post(url, { messaging_product: 'whatsapp', to: to, text: { body: text } }, {
      headers: { 'Authorization': `Bearer ${WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' }
    });
    console.log('Sent OK');
  } catch (e) { console.error('Send failed:', e.response?.data || e.message); }
}

// --- Send WhatsApp Flow (Blocked by Meta integrity, kept for later) ---
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
              screen: 'WELCOME',
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
app.get('/', (req,res) => res.send('Farmer Bot Live - Multilingual'));
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
  const lang = farmer.data.lang || 'en';
  const t = translations[lang];

  // --- CANCEL / RESTART COMMAND (works at any time) ---
  if (['cancel', 'restart', 'start over'].includes(text.toLowerCase())) {
    farmer.state = 'idle';
    farmer.data = {};
    farmer.markModified('data');
    await farmer.save();
    reply = t.cancelled + '\n\n' + translations.en.welcome;
    return await sendWhatsApp(from, reply);
  }
  // ---------------------------------------------------

  if (farmer.state === 'idle') {
    if (['hi', 'hello', 'register'].includes(text.toLowerCase())) {
      farmer.state = 'set_language';
      farmer.data = {}; // Reset data
      reply = translations.en.welcome; // Always show English first for the menu
    } else {
      reply = 'Welcome! Type "Register" to start, or "Cancel" to reset.';
    }
  }
  else if (farmer.state === 'set_language') {
    let selectedLang = 'en';
    if (text === '1' || text.toLowerCase() === 'english') selectedLang = 'en';
    else if (text === '2' || text.toLowerCase() === 'isizulu') selectedLang = 'zu';
    else if (text === '3' || text.toLowerCase() === 'afrikaans') selectedLang = 'af';
    else if (text === '4' || text.toLowerCase() === 'sesotho') selectedLang = 'st';
    else {
      reply = translations.en.invalidLang; 
      return await sendWhatsApp(from, reply);
    }

    farmer.data.lang = selectedLang;
    farmer.markModified('data');
    farmer.state = 'profile_name';
    
    // Load the correct translation immediately for this reply
    reply = translations[selectedLang].askName; 
  }
  // --- PROFILE SECTION ---
  else if (farmer.state === 'profile_name') {
    farmer.data.name = text; farmer.markModified('data'); farmer.state = 'profile_id';
    reply = t.askId;
  }
  else if (farmer.state === 'profile_id') {
    farmer.data.id = text; farmer.markModified('data'); farmer.state = 'profile_manager';
    reply = t.askManager;
  }
  else if (farmer.state === 'profile_manager') {
    farmer.data.manager = text; farmer.markModified('data'); farmer.state = 'profile_permit';
    reply = t.askPermit;
  }
  else if (farmer.state === 'profile_permit') {
    farmer.data.permit = text; farmer.markModified('data'); farmer.state = 'profile_contact';
    reply = t.askContact;
  }
  else if (farmer.state === 'profile_contact') {
    farmer.data.contact = text; farmer.markModified('data'); farmer.state = 'profile_email';
    reply = t.askEmail;
  }
  else if (farmer.state === 'profile_email') {
    farmer.data.email = text; farmer.markModified('data'); farmer.state = 'profile_gps';
    reply = t.askGps;
  }
  else if (farmer.state === 'profile_gps') {
    farmer.data.gps = text; farmer.markModified('data'); farmer.state = 'profile_province';
    reply = t.askProvince;
  }
  else if (farmer.state === 'profile_province') {
    farmer.data.province = text; farmer.markModified('data'); farmer.state = 'profile_district';
    reply = t.askDistrict;
  }
  else if (farmer.state === 'profile_district') {
    farmer.data.district = text; farmer.markModified('data'); farmer.state = 'profile_municipality';
    reply = t.askMunicipality;
  }
  else if (farmer.state === 'profile_municipality') {
    farmer.data.municipality = text; farmer.markModified('data'); farmer.state = 'profile_size';
    reply = t.askFarmSize;
  }
  else if (farmer.state === 'profile_size') {
    farmer.data.farmSize = text; farmer.markModified('data'); farmer.state = 'profile_hemp';
    reply = t.askHemp;
  }
  else if (farmer.state === 'profile_hemp') {
    farmer.data.hempAmount = text; farmer.markModified('data'); farmer.state = 'section2_calendar';
    reply = t.askCalendar;
  }
  // --- SECTION 2: PRODUCTION CALENDAR ---
  else if (farmer.state === 'section2_calendar') {
    farmer.data.calendar = text; farmer.markModified('data'); farmer.state = 'section3_plot1';
    reply = t.askPlot1;
  }
  // --- SECTION 3: FIELD AND SITE SELECTION ---
  else if (farmer.state === 'section3_plot1') {
    farmer.data.plot1 = text; farmer.markModified('data'); farmer.state = 'section3_plot2';
    reply = t.askPlot2;
  }
  else if (farmer.state === 'section3_plot2') {
    farmer.data.plot2 = text; farmer.markModified('data'); farmer.state = 'section3_plot3';
    reply = t.askPlot3;
  }
  else if (farmer.state === 'section3_plot3') {
    farmer.data.plot3 = text; farmer.markModified('data');
    
    // Save everything to MongoDB and Google Sheets
    await saveToSheet(from, farmer.data);
    farmer.state = 'idle';
    reply = t.done;
  }
  else {
    reply = 'Type "Register" to start, or "Cancel" to reset.';
  }

  await farmer.save();
  if (reply) await sendWhatsApp(from, reply); 
});

app.listen(process.env.PORT || 10000, () => console.log('Server running on port ' + (process.env.PORT || 10000)));