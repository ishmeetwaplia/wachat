const express = require('express');
const { protect, authorizeRoles } = require('../middleware/auth');
const tenantController = require('../controllers/tenantController');

const router = express.Router();

// Only super admin can create new tenants
router.post('/', protect, authorizeRoles('super_admin'), tenantController.createTenant); // You'll need logic in controller to check if current user's tenant isSuperAdmin
router.get('/', protect, authorizeRoles('super_admin'), tenantController.getAllTenants); // For super admin to view all
router.put('/:id/status', protect, authorizeRoles('super_admin'), tenantController.updateTenantStatus); // On/Off control
router.put('/:id', protect, authorizeRoles('super_admin','tenant_admin'), tenantController.updateTenantSettings); // On/Off control

module.exports = router;


// controllers/tenantController.js
