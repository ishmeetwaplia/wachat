const express = require('express');
const { protect, authorizeRoles } = require('../middleware/auth');
const router = express.Router();
const projectController = require('../controllers/projectController');
const { responseHandler } = require('../middleware/responseHandler');
const validate = require('../middleware/validate');
const { createProjectSchema, updateBatchSize } = require('../validations/projectValidation');
const validateRequest = require('../middleware/validate');

router.route('/')
  .post(
    protect,
    authorizeRoles('user'),
    validate(createProjectSchema),
    responseHandler(projectController.createProjectController)
  )
  .get(
    protect,
    authorizeRoles('user'),
    responseHandler(projectController.getAllProjectsController)
  );

router.get('/:id/dashboard', protect, authorizeRoles('user'), responseHandler(projectController.getProjectByIdController));
router.delete('/:projectId', protect, responseHandler(projectController.deleteProjectController));
router.put('/:projectId/whatsapp-business-profile', protect, responseHandler(projectController.updateWhatsappBusinessProfileController));
router.get('/:projectId/batch-size', protect, responseHandler(projectController.getBatchSizeController));
router.put('/:projectId/batch-size', protect, validateRequest(updateBatchSize), responseHandler(projectController.updateBatchSizeController));

// router
//   .put("/:id",
//     protect,
//     authorizeRoles('user'),
//     responseHandler(projectController.updateProjectController)
//   );
  // .delete(
  //   protect,
  //   authorizeRoles('user'),
  //   validate(validateProjectId, 'params'),
  //   responseHandler(projectController.deleteProject)
  // );

// router.delete('/:id/delete', protect, authorizeRoles('user'), responseHandler(projectController.deleteProject));
// router.put('/:projectId', protect, responseHandler(projectController.updateProjectController));

module.exports = router;
