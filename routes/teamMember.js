const express = require('express');
const { protect } = require('../middleware/auth');
const {responseHandler} = require('../middleware/responseHandler');
const teamMemberController = require('../controllers/teamMemberController'); 

const router = express.Router({ mergeParams: true });

router.post("/", protect, responseHandler(teamMemberController.createController));
router.get("/", protect,responseHandler(teamMemberController.getAllController));
router.get("/:id", protect, responseHandler(teamMemberController.getByIdController));
router.put("/:id", protect, responseHandler(teamMemberController.updateController));
router.delete("/:id", protect, responseHandler(teamMemberController.deleteController));

module.exports = router;
