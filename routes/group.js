const express = require('express');
const { protect } = require('../middleware/auth');
const groupController = require('../controllers/groupController');
const { responseHandler } = require("../middleware/responseHandler");
const validateRequest = require("../middleware/validate");
const groupValidation = require("../validations/groupValidations");

const router = express.Router({ mergeParams: true });

router.post("/", protect, validateRequest(groupValidation.createGroup), groupController.createController);
router.get("/", protect, groupController.getController);
router.delete("/", protect, groupController.multiDeleteController);
router.get("/archiveList", protect, groupController.archiveListController);
router.get("/:groupId", protect, groupController.editGetController);
router.put("/:groupId", protect, validateRequest(groupValidation.updateGroup), groupController.editController);
router.delete("/:groupId", protect, responseHandler(groupController.deleteController));
router.put("/archive/:groupId", protect, groupController.updateFalseStatusController);
router.put("/removeArchive/:groupId", protect, groupController.updateTrueStatusController);
router.post("/bulk-delete", protect, responseHandler(groupController.bulkDeleteController));
router.post("/unarchive",validateRequest(groupValidation.multiArchiveUpdate), protect, responseHandler(groupController.unarchiveController));
router.patch("/multi/archive", protect,validateRequest(groupValidation.multiArchiveUpdate), groupController.multiUpdateController);

module.exports = router;
