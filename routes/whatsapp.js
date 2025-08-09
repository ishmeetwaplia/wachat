// server/routes/whatsapp.js
const express = require('express');
const { protect } = require('../middleware/auth');
const {responseHandler} = require('../middleware/responseHandler');
const whatsappController = require('../controllers/whatsappController');

const router = express.Router();

// Get WhatsApp phone numbers using WABA ID and Access Token from request body
router.post("/phone-numbers", protect, responseHandler(whatsappController.getPhoneNumbersController));

module.exports = router;
