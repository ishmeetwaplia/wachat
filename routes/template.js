const express = require('express');
const { protect } = require('../middleware/auth');
const {responseHandler} = require('../middleware/responseHandler');
const templateController = require('../controllers/templateController');
const mediaUpload = require('../config/multerMediaConfig');

const router = express.Router();

router.post("/", protect, responseHandler(templateController.createController));
router.post('/upload-media', protect, mediaUpload.single('file'), responseHandler(templateController.uploadMedia));
router.post('/carousel-templates', protect, responseHandler(templateController.createCarouselTemplateController));
router.get("/plain", protect, responseHandler(templateController.getPlainTextController))

// Submit a locally created template to Meta for approval
router.post("/:id/submit-to-meta", protect, responseHandler(templateController.submitToMetaController));
router.get("/", protect, responseHandler(templateController.getAllController));
router.get("/allapprovedtemplates", protect, responseHandler(templateController.getAllApprovedTemplatesController));
router.get("/allapprovedcarouseltemplates", protect, responseHandler(templateController.getAllApprovedCarosualTemplatesController))
router.get("/:id", protect, responseHandler(templateController.getByIdController));
router.put("/:id", protect, responseHandler(templateController.updateController));
router.delete("/:id", protect, responseHandler(templateController.deleteController));
router.post("/sync-from-meta", protect, responseHandler(templateController.syncTemplatesFromMetaController));
router.post('/auth', protect, responseHandler(templateController.authTemplateController));

module.exports = router;
