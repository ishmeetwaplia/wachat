const express = require('express');
const tenantResolver = require('../middleware/tenantResolver'); // Need to resolve tenant first
const siteController = require('../controllers/siteController');

const router = express.Router();

// Get public site details for the resolved tenant
router.get('/config', tenantResolver, siteController.getSiteConfig);

module.exports = router;

// controllers/siteController.js

