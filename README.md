# Farmer Registration WhatsApp Bot - Render Version

From your screenshot:
- Test Number: +1 (555) 196-5782
- Phone Number ID: 1307599989103567
- Your phone: +27-72-115-1539

## 1. Get Token (30 sec)
On your current Meta page:
- Click "Generate token" under Access token -> Copy the long EAA... token
  This is WHATSAPP_TOKEN

## 2. Push to GitHub
- Create new repo on github.com (public)
- Upload these 3 files: index.js, package.json, .gitignore

## 3. Deploy to Render.com (Free, no card)
- Go to dashboard.render.com > New > Web Service
- Connect your GitHub repo
- Settings:
  Name: farmer-bot
  Runtime: Node
  Build: npm install
  Start: npm start
- Environment Variables (Add):
  WHATSAPP_TOKEN = EAA... (from step 1)
  PHONE_NUMBER_ID = 1307599989103567
  VERIFY_TOKEN = farmer_app_token_2026

- Click Deploy. Wait 2 min. You get URL: https://farmer-bot-xxxx.onrender.com

## 4. Tell Meta your new URL (No more ngrok!)
Meta > WhatsApp > Configuration > Webhook
Callback URL: https://farmer-bot-xxxx.onrender.com/webhook
Verify token: farmer_app_token_2026
Subscribe: messages

Click Verify and save -> Should say Verified instantly.

## 5. Test
On Meta page "Send a message from your test number":
To: +27-72-115-1539
Send "Register" -> You will get reply on WhatsApp!

## DeepSeek Prompt:
"Deploy this Node Express WhatsApp bot to Render. It uses dotenv, verifies webhook with VERIFY_TOKEN, and sends replies via Graph API v20.0/{PHONE_NUMBER_ID}/messages. Make sure it works on Render with process.env.PORT"

