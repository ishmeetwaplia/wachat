const express = require('express');
const { protect, authorizeRoles } = require('../middleware/auth');
const userController = require('../controllers/userController');
const { responseHandler } = require('../middleware/responseHandler');
const validateRequest = require('../middleware/validate');
const {register,login, forgotPassword, resetPassword, verifyOtp, update, resetPasswordWithOtp , resendOtp } = require('../validations/userValidations');
const { loginLimiter , otpLimiter } = require("../middleware/rateLimiter");
const router = express.Router();

router.post('/register', otpLimiter , validateRequest(register), responseHandler(userController.registerController));
router.post('/verifyOtp',otpLimiter ,  validateRequest(verifyOtp), responseHandler(userController.verifyOtpController));
router.post('/login', validateRequest(login), loginLimiter, userController.authUser);
router.get('/profile', protect, userController.getUserProfile);
router.put('/profile', protect, validateRequest(update), userController.updateUserProfile);
router.get('/', protect, authorizeRoles('tenant_admin', 'super_admin'), userController.getAllUsersForTenant);
router.post('/admin-register', protect, authorizeRoles('tenant_admin', 'super_admin'), validateRequest(register), userController.registerUserByAdmin);
router.post('/business-profiles', protect, userController.createBusinessProfile);
router.get('/business-profiles', protect, userController.getAllBusinessProfilesForUser);
router.put('/business-profiles/:id', protect, responseHandler(userController.updateBusinessProfileController));
router.put('/reset-password', protect, validateRequest(resetPassword), userController.resetPasswordController);
router.post('/forgot-password',otpLimiter ,  validateRequest(forgotPassword), responseHandler(userController.forgotPasswordController));
router.post('/update-password-with-otp',otpLimiter , validateRequest(resetPasswordWithOtp), responseHandler(userController.updatePasswordWithOtpController));
router.put('/update-self/:userId', protect, validateRequest(update), responseHandler(userController.updateUserController));
router.post('/logout', protect, responseHandler(userController.logoutUserController));
router.post('/resend-otp',otpLimiter, validateRequest(resendOtp), responseHandler(userController.resendOtpController));

module.exports = router;
