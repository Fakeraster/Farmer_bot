const express = require('express');
const app = express();
app.use(express.json());

app.get('/', (req, res) => res.send('Bot is running - use /webhook'));
app.get('/webhook', (req, res) => {
  console.log('VERIFY ATTEMPT:', req.query);
  if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === 'farmer_app_token_2026') {
    console.log('WEBHOOK_VERIFIED');
    return res.status(200).send(req.query['hub.challenge']);
  }
  console.log('VERIFY FAILED');
  res.sendStatus(403);
});

app.post('/webhook', (req, res) => {
  console.log('POST RECEIVED:', JSON.stringify(req.body, null, 2));
  res.status(200).send('EVENT_RECEIVED');
});

app.listen(3000, () => console.log('Server listening on port 3000 - READY'));
