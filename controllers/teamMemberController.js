// server/controllers/teamMemberController.js
const teamMemberService = require('../services/teamMemberService');

// Controllers simply call the service and return its result for responseHandler to process

exports.createController = async (req) => {
    return await teamMemberService.createTeamMember(req);
};

exports.getAllController = async (req) => {
    return await teamMemberService.getAllTeamMembers(req);
};

exports.getByIdController = async (req) => {
    return await teamMemberService.getTeamMemberById(req);
};

exports.updateController = async (req) => {
    return await teamMemberService.updateTeamMember(req);
};

exports.deleteController = async (req) => {
    return await teamMemberService.deleteTeamMember(req);
};
