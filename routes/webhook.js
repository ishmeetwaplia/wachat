// server/routes/webhook.js
const express = require('express');
const webhookService = require('../services/webhookService');
const {responseHandler} = require('../middleware/responseHandler');

const router = express.Router();

// Meta webhook VERIFICATION endpoint (GET request)
// Now a fixed URL. Meta will send 'hub.mode', 'hub.verify_token', 'hub.challenge' as query params.
router.get('/whatsapp', responseHandler(webhookService.handleWebhookPayload));

// Meta webhook EVENT endpoint (POST request for incoming messages/status updates)
// Now a fixed URL. The phone number ID will be extracted from the payload body.
router.post('/whatsapp', responseHandler(webhookService.handleWebhookPayload));

module.exports = router;
