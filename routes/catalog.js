const express = require("express");
const { protect } = require("../middleware/auth");
const { responseHandler } = require("../middleware/responseHandler");
const controller = require("../controllers/catalogController");

const router = express.Router();

router.post("/:metaBusinessId", protect, responseHandler(controller.createContactController));

module.exports = router;
