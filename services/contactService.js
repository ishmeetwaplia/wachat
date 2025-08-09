const Contact = require("../models/Contact");
const Group = require("../models/Group"); // Needed to validate groupIds
const { statusCode, resMessage } = require("../config/constants");
const XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");
const mongoose = require('mongoose');
const Project = require("../models/project");

const validateGroupIds = async (tenantId, userId, projectId, groupIds) => {
    if (!groupIds || groupIds.length === 0) {
        return { isValid: true, invalidGroups: [] };
    }
    const existingGroups = await Group.find({
        _id: { $in: groupIds },
        tenantId,
        userId,
        projectId
    });
    const foundGroupIds = new Set(existingGroups.map(group => group._id.toString()));
    const invalidGroups = groupIds.filter(id => !foundGroupIds.has(id.toString()));
    return { isValid: invalidGroups.length === 0, invalidGroups };
};

exports.create = async (req) => {
    const { name, email, mobileNumber, groupIds, isBlocked } = req.body;
    const userId = req.user._id;
    const tenantId = req.tenant._id;
    const projectId = req.params.projectId;

    if (!name || (!email && !mobileNumber)) {
        return {
            status: statusCode.BAD_REQUEST,
            success: false,
            message: "Name and either email or mobileNumber are required."
        };
    }

    try {
        if (mobileNumber) {
            const existingContact = await Contact.findOne({ tenantId, userId, projectId, mobileNumber });
            if (existingContact) {
                return {
                    status: statusCode.CONFLICT,
                    success: false,
                    message: resMessage.Contact_already_exists
                };
            }
        }

        const { isValid, invalidGroups } = await validateGroupIds(tenantId, userId, projectId, groupIds);
        if (!isValid) {
            return {
                status: statusCode.BAD_REQUEST,
                success: false,
                message: `Invalid group IDs provided: ${invalidGroups.join(', ')}`
            };
        }

        const knownFields = ['name', 'email', 'mobileNumber', 'groupIds', 'isBlocked'];
        const customFields = {};

        for (const key in req.body) {
            if (!knownFields.includes(key)) {
                customFields[key] = req.body[key];  
            }
        }

        const contactPayload = {
            tenantId,
            userId,
            projectId,
            name,
            email,
            mobileNumber,
            groupIds,
            isBlocked,
            customFields
        };

        const contact = await Contact.create(contactPayload);


        return {
            status: statusCode.CREATED,
            success: true,
            message: resMessage.Contact_created_successfully,
            data: contact
        };
    } catch (error) {
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: resMessage.Server_error,
            error: error.message
        };
    }
};

// @desc    Upload contacts from an Excel/CSV file
// exports.uploadContact = async (req) => {
//     const userId = req.user._id;
//     const tenantId = req.tenant._id;
//     const projectId = req.params.projectId;

//     if (!req.file) {
//         return {
//             status: statusCode.BAD_REQUEST,
//             success: false,
//             message: resMessage.No_file_uploaded
//         };
//     }

//     const filePath = req.file.path;
//     const importedContacts = [];
//     const errors = [];

//     try {
//         const workbook = xlsx.readFile(filePath);
//         const sheetName = workbook.SheetNames[0];
//         const sheet = workbook.Sheets[sheetName];
//         const data = xlsx.utils.sheet_to_json(sheet);
// console.log("data", data);
//         for (const row of data) {
//             const { Name, Email, mobileNumber, Groups } = row; // Assuming column headers in file are Name, Email, mobileNumber, Groups (comma-separated IDs)
//             let groupIds = [];
//             if (Groups) {
//                 groupIds = Groups.split(',').map(id => id.trim()).filter(id => mongoose.Types.ObjectId.isValid(id));
//             }

//             try {
//                 // Validate groupIds for each contact
//                 const { isValid, invalidGroups } = await validateGroupIds(tenantId, userId, projectId, groupIds);
//                 if (!isValid) {
//                     errors.push({ row, reason: `Invalid group IDs: ${invalidGroups.join(', ')}` });
//                     continue;
//                 }

//                 // Check for existing contact by mobileNumber number
//                 let existingContact = null;
//                 if (mobileNumber) {
//                     existingContact = await Contact.findOne({ tenantId, userId, projectId, mobileNumber: mobileNumber });
//                 }

//                 if (existingContact) {
//                     errors.push({ row, reason: `Contact with mobileNumber ${mobileNumber} already exists.` });
//                 } else {
//                     const newContact = await Contact.create({
//                         tenantId,
//                         userId,
//                         projectId,
//                         name: Name,
//                         email: Email,
//                         mobileNumber: mobileNumber,
//                         groupIds
//                     });
//                     importedContacts.push(newContact);
//                 }
//             } catch (contactError) {
//                 console.error("Error processing contact row:", row, contactError);
//                 errors.push({ row, reason: `Failed to create contact: ${contactError.message}` });
//             }
//         }

//         // Clean up the uploaded file
//         // fs.unlinkSync(filePath);

//         if (errors.length > 0) {
//             return {
//                 status: statusCode.OK, // Still 200 even with some errors
//                 success: true,
//                 message: `File processed with ${importedContacts.length} contacts imported and ${errors.length} errors.`,
//                 data: { importedContacts, errors }
//             };
//         }

//         return {
//             status: statusCode.CREATED,
//             success: true,
//             message: resMessage.File_upload_successful,
//             data: { importedContacts }
//         };

//     } catch (error) {
//         console.error("Error in uploadContact service:", error);
//         // Clean up the file even if parsing fails
//         // if (fs.existsSync(filePath)) {
//         //     fs.unlinkSync(filePath);
//         // }
//         return {
//             status: statusCode.INTERNAL_SERVER_ERROR,
//             success: false,
//             message: resMessage.File_upload_failed,
//             error: error.message
//         };
//     }
// };

exports.uploadContact = async (req) => {
    try {
    const userId = req.user._id;
        const tenantId = req.tenant._id;
        const projectId = req.params.projectId;
    
        const checkProject = await Project.findOne({ _id: projectId, userId });
        if (!checkProject) {
            console.warn("❌ Project not found or does not belong to user");
            return {
                status: statusCode.NOT_FOUND,
                success: false,
                message: resMessage.ProjectId_dont_exists,
                statusCode: statusCode.NOT_FOUND,
            };
        }

        const mapping = JSON.parse(req.body.mapping).map(key => key.toLowerCase());
        

        let groupNames = [];
        try {
            groupNames = JSON.parse(req.body.groupName);
        } catch (e) {
            groupNames = req.body.groupName ? [req.body.groupName] : [];
        }
 
        const filePath = req.file.path;
 
 
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rawData = XLSX.utils.sheet_to_json(worksheet);
 
        const normalizedData = rawData.map(row => {
            const lowerRow = {};
            for (let key in row) {
                lowerRow[key.toLowerCase()] = row[key];
            }
            return lowerRow;
        });
 
        const seenMobileNumbers = new Set();
        const filteredData = [];
        const errors = [];
 
        let groupIds = [];
        if (groupNames.length > 0) {
            const existingGroups = await Group.find({
                title: { $in: groupNames },
                tenantId,
                userId
            });

            groupIds = existingGroups.map(g => g._id);

            const foundNames = existingGroups.map(g => g.name);
            const missing = groupNames.filter(name => !foundNames.includes(name));
            if (missing.length > 0) {
                console.warn(`⚠️ Groups not found: ${missing.join(", ")}`);
            }
        }

        for (const [index, row] of normalizedData.entries()) {
            const newRow = {
                tenantId,
                userId,
                projectId,
                groupIds,
                tags: [],
                customFields: {},
            };
 
            for (const key of mapping) {
                newRow[key] = row[key];
            }
            if (!newRow.mobile) {
                newRow.mobile =
                    row["mobile"] ||
                    row["mobilenumber"] ||
                    row["mobileNumber"] ||
                    row["phone"];
            }
            
            let mobileNumber = newRow["mobileNumber"] || newRow["mobilenumber"] || newRow["phone"] || newRow["mobile"];
            if (!mobileNumber) {
                errors.push({ rowNumber: index + 2, reason: "Missing mobile number" });
                continue;
            }
 
            if (typeof mobileNumber === 'string') {
                mobileNumber = mobileNumber.trim();
            }
 
            const normalizedMobile = String(mobileNumber).replace(/\D/g, '');
 
            if (seenMobileNumbers.has(normalizedMobile)) {
                console.warn(`⚠️ Row ${index + 2} duplicate in file: ${mobileNumber}`);
                errors.push({ rowNumber: index + 2, reason: `Duplicate in file: ${mobileNumber}` });
                continue;
            }
 
            seenMobileNumbers.add(normalizedMobile);
            newRow.mobileNumber = mobileNumber;
 
            const exists = await Contact.findOne({
                tenantId,
                userId,
                projectId,
                mobileNumber,
            });
 
            if (exists) {
                errors.push({ rowNumber: index + 2, reason: `Duplicate in DB: ${mobileNumber}` });
                continue;
            }
 
            // Fill optional schema fields
            const mobileStr = String(mobileNumber).trim();
            newRow.name = row["name"] || '';
            newRow.email = row["email"] || '';
            newRow.countryCode = row["countrycode"] || (mobileStr ? mobileStr.slice(0, 2) : '');
            newRow.profileName = row["profilename"] || mobileStr || '';
            newRow.whatsappId = row["whatsappid"] || mobileStr || '';
 
            // Collect customFields
            const schemaFields = [
                "name", "email", "mobileNumber", "mobilenumber", "phone",
                "countrycode", "profilename", "whatsappid", ...mapping
            ];
            Object.keys(row).forEach(key => {
                if (!schemaFields.includes(key)) {
                    newRow.customFields[key] = row[key];
                }
            });
            filteredData.push(newRow);
        }
        if (filteredData.length > 0) {
            await Contact.insertMany(filteredData);
        } else {
            console.warn("⚠️ No valid contacts to insert");
        }
 
        fs.unlinkSync(filePath);
 
        return {
            status: statusCode.CREATED,
            success: true,
            message: resMessage.File_upload_successful,
            data: {
                importedContacts: filteredData.length,
                failedContacts: errors.length,
                errors
            }
        };
 
    } catch (error) {
        console.error("🔥 Error in uploadContact service:", error);
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: resMessage.File_upload_failed,
            error: error.message
        };
    }
};
 
exports.contactList = async (req) => {
    const userId = req.user._id;
    const tenantId = req.tenant._id;
    const projectId = req.params.projectId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const searchText = req.query.search || "";
    const groupId = req.query.groupId;

    try {
        const searchCondition = {
            tenantId,
            userId,
            projectId,
            isBlocked: false
        };

        if (searchText) {
            searchCondition.$or = [
                { name: { $regex: searchText, $options: "i" } },
                { email: { $regex: searchText, $options: "i" } },
                { mobileNumber: { $regex: searchText, $options: "i" } }
            ];
        }

        if (groupId && mongoose.Types.ObjectId.isValid(groupId)) {
            searchCondition.groupIds = groupId;
        }

        const [data, total] = await Promise.all([
            Contact.find(searchCondition)
                .sort({ name: 1 })
                .skip(skip)
                .limit(limit)
                .populate('groupIds', 'title'),
            Contact.countDocuments(searchCondition)
        ]);

        return {
            status: statusCode.OK,
            success: true,
            message: data.length === 0
                ? resMessage.No_contacts_found
                : resMessage.Contacts_fetch_successfully,
            data,
            pagination: {
                total,
                currentPage: page,
                totalPages: Math.ceil(total / limit),
            }
        };
    } catch (error) {
        console.error("Error in contactList service:", error);
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: resMessage.Server_error,
            error: error.message
        };
    }
};

exports.blockContact = async (req) => {
    const userId = req.user._id;
    const tenantId = req.tenant._id;
    const projectId = req.params.projectId;
    const contactId = req.params.contactId;

    try {
        const contact = await Contact.findOne({ _id: contactId, tenantId, userId, projectId });
        if (!contact) {
            return {
                status: statusCode.NOT_FOUND,
                success: false,
                message: resMessage.Contact_not_found
            };
        }

        contact.isBlocked = true;
        await contact.save();

        return {
            status: statusCode.OK,
            success: true,
            message: resMessage.Contact_blocked_successfully,
            data: contact
        };
    } catch (error) {
        console.error("Error in blockContact service:", error);
        if (error.name === 'CastError') {
            return { status: statusCode.BAD_REQUEST, success: false, message: "Invalid contact ID." };
        }
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: resMessage.Server_error,
            error: error.message
        };
    }
};

exports.groupList = async (req) => {
    const userId = req.user._id;
    const tenantId = req.tenant._id;
    const projectId = req.params.projectId;

    try {
        const groups = await Group.find({ tenantId, userId, projectId, isActive: true }).select('title description');
        if (!groups || groups.length === 0) {
            return {
                status: statusCode.OK,
                success: true,
                data: [],
                message: resMessage.No_groups_found
            };
        }
        return {
            status: statusCode.OK,
            success: true,
            message: resMessage.Groups_fetch_successfully,
            data: groups
        };
    } catch (error) {
        console.error("Error in groupList service (contactService):", error);
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: resMessage.Server_error,
            error: error.message
        };
    }
};

// exports.contactById = async (req) => {
//     const userId = req.user._id;
//     const tenantId = req.tenant._id;
//     const projectId = req.params.projectId;
//     const contactId = req.params.contactId;

//     try {
//         const contact = await Contact.findOne({ _id: contactId, tenantId, userId, projectId }).populate('groupIds', 'title');
//         if (!contact) {
//             return {
//                 status: statusCode.NOT_FOUND,
//                 success: false,
//                 message: resMessage.Contact_not_found
//             };
//         }
//         return {
//             status: statusCode.OK,
//             success: true,
//             message: resMessage.Contacts_fetch_successfully,
//             data: contact
//         };
//     } catch (error) {
//         console.error("Error in contactById service:", error);
//         if (error.name === 'CastError') {
//             return { status: statusCode.BAD_REQUEST, success: false, message: "Invalid contact ID." };
//         }
//         return {
//             status: statusCode.INTERNAL_SERVER_ERROR,
//             success: false,
//             message: resMessage.Server_error,
//             error: error.message
//         };
//     }
// };

exports.updateContact = async (req) => {
    const userId = req.user._id;
    const tenantId = req.tenant._id;
    const projectId = req.params.projectId;
    const contactId = req.params.contactId;
    const { name, email, mobileNumber, groupIds } = req.body;

    try {
        const contact = await Contact.findOne({ _id: contactId, tenantId, userId, projectId });
        if (!contact) {
            return {
                status: statusCode.NOT_FOUND,
                success: false,
                message: resMessage.Contact_not_found
            };
        }

        if (mobileNumber && mobileNumber !== contact.mobileNumber) {
            const existingPhoneContact = await Contact.findOne({
                tenantId,
                userId,
                projectId,
                mobileNumber,
                _id: { $ne: contactId }
            });
            if (existingPhoneContact) {
                return {
                    status: statusCode.CONFLICT,
                    success: false,
                    message: resMessage.Contact_already_exists
                };
            }
        }
        const { isValid, invalidGroups } = await validateGroupIds(tenantId, userId, projectId, groupIds);
        if (!isValid) {
            return {
                status: statusCode.BAD_REQUEST,
                success: false,
                message: `Invalid group IDs provided: ${invalidGroups.join(', ')}`
            };
        }

        // Update base fields
        contact.name = name || contact.name;
        contact.email = email !== undefined ? email : contact.email;
        contact.mobileNumber = mobileNumber !== undefined ? mobileNumber : contact.mobileNumber;
        contact.groupIds = groupIds !== undefined ? groupIds : contact.groupIds;


        // Update custom fields
        const knownFields = ['name', 'email', 'mobileNumber', 'groupIds', 'isBlocked'];
        const customFieldUpdates = {};
        for (const key in req.body) {
            if (!knownFields.includes(key)) {
                customFieldUpdates[key] = req.body[key];
            }
        }

        if (Object.keys(customFieldUpdates).length > 0) {
            contact.customFields = {
                ...(contact.customFields || {}),
                ...customFieldUpdates
            };
        } else {
        }

        await contact.save();

        return {
            status: statusCode.OK,
            success: true,
            message: resMessage.Contact_updated_successfully,
            data: contact
        };
    } catch (error) {
        if (error.name === 'CastError') {
            return {
                status: statusCode.BAD_REQUEST,
                success: false,
                message: "Invalid contact ID."
            };
        }
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: resMessage.Server_error,
            error: error.message
        };
    }
};

exports.deleteContact = async (req) => {
    const userId = req.user._id;
    const tenantId = req.tenant._id;
    const projectId = req.params.projectId;
    const contactId = req.params.contactId;

    try {
        const contact = await Contact.findOneAndDelete({ _id: contactId, tenantId, userId, projectId });
        if (!contact) {
            return {
                status: statusCode.NOT_FOUND,
                success: false,
                message: resMessage.Contact_not_found
            };
        }
        return {
            status: statusCode.OK,
            success: true,
            message: resMessage.Contact_deleted_successfully
        };
    } catch (error) {
        console.error("Error in deleteContact service:", error);
        if (error.name === 'CastError') {
            return { status: statusCode.BAD_REQUEST, success: false, message: "Invalid contact ID." };
        }
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: resMessage.Server_error,
            error: error.message
        };
    }
};

exports.multiUpdate = async (req) => {
    const { ids, updateFields } = req.body; 
    const userId = req.user._id;
    const tenantId = req.tenant._id;
    const projectId = req.params.projectId;

    if (!Array.isArray(ids) || ids.length === 0) {
        return {
            status: statusCode.BAD_REQUEST,
            success: false,
            message: resMessage.No_IDs_provided_for_updation
        };
    }
    if (!updateFields || Object.keys(updateFields).length === 0) {
        return {
            status: statusCode.BAD_REQUEST,
            success: false,
            message: "No update fields provided."
        };
    }

    try {
        if (updateFields.groupIds !== undefined) {
            const { isValid, invalidGroups } = await validateGroupIds(tenantId, userId, projectId, updateFields.groupIds);
            if (!isValid) {
                return {
                    status: statusCode.BAD_REQUEST,
                    success: false,
                    message: `Invalid group IDs provided for bulk update: ${invalidGroups.join(', ')}`
                };
            }
        }

        const result = await Contact.updateMany(
            { _id: { $in: ids }, tenantId, userId, projectId },
            { $set: updateFields }
        );

        if (result.modifiedCount === 0) {
            return {
                status: statusCode.NOT_FOUND,
                success: false,
                message: resMessage.No_contacts_found
            };
        }

        return {
            status: statusCode.OK,
            success: true,
            message: resMessage.Bulk_update_successful,
            data: { modifiedCount: result.modifiedCount }
        };
    } catch (error) {
        console.error("Error in multiUpdate service:", error);
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: resMessage.Server_error,
            error: error.message
        };
    }
};

exports.blackList = async (req) => {
    const userId = req.user._id;
    const tenantId = req.tenant._id;
    const projectId = req.params.projectId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const searchText = req.query.search || "";

    try {
        const searchCondition = {
            tenantId,
            userId,
            projectId,
            isBlocked: true
        };

        if (searchText) {
            searchCondition.$or = [
                { name: { $regex: searchText, $options: "i" } },
                { email: { $regex: searchText, $options: "i" } },
                { mobileNumber: { $regex: searchText, $options: "i" } }
            ];
        }

        const [data, total] = await Promise.all([
            Contact.find(searchCondition).sort({ name: 1 }).skip(skip).limit(limit).populate('groupIds', 'title'),
            Contact.countDocuments(searchCondition)
        ]);

        if (!data || data.length === 0) {
            return {
                status: statusCode.OK,
                success: true,
                data: [],
                message: resMessage.No_contacts_found
            };
        }

        return {
            status: statusCode.OK,
            success: true,
            message: resMessage.Contacts_fetch_successfully,
            data,
            pagination: {
                total,
                currentPage: page,
                totalPages: Math.ceil(total / limit),
            }
        };
    } catch (error) {
        console.error("Error in blackList service:", error);
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: resMessage.Server_error,
            error: error.message
        };
    }
};

exports.removeBlackListContact = async (req) => {
    const userId = req.user._id;
    const tenantId = req.tenant._id;
    const projectId = req.params.projectId;
    const contactId = req.params.contactId;

    try {
        const contact = await Contact.findOne({ _id: contactId, tenantId, userId, projectId });
        if (!contact) {
            return {
                status: statusCode.NOT_FOUND,
                success: false,
                message: resMessage.Contact_not_found
            };
        }

        contact.isBlocked = false;
        await contact.save();

        return {
            status: statusCode.OK,
            success: true,
            message: resMessage.Contact_unblocked_successfully,
            data: contact
        };
    } catch (error) {
        console.error("Error in removeBlackListContact service:", error);
        if (error.name === 'CastError') {
            return { status: statusCode.BAD_REQUEST, success: false, message: "Invalid contact ID." };
        }
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: resMessage.Server_error,
            error: error.message
        };
    }
};

exports.removeBulkContact = async (req) => {
    const { ids } = req.body;
    console.log("Bulk delete request for contact IDs:", ids);
    const userId = req.user._id;
    const tenantId = req.tenant._id;
    const projectId = req.params.projectId;

    if (!Array.isArray(ids) || ids.length === 0) {
        return {
            status: statusCode.BAD_REQUEST,
            success: false,
            message: resMessage.No_IDs_provided_for_deletion
        };
    }

    try {
        const result = await Contact.deleteMany({
            _id: { $in: ids },
            tenantId,
            userId,
            projectId
        });

        if (result.deletedCount === 0) {
            return {
                status: statusCode.NOT_FOUND,
                success: false,
                message: resMessage.No_contacts_found
            };
        }

        return {
            status: statusCode.OK,
            success: true,
            message: resMessage.Bulk_delete_successful,
            data: { deletedCount: result.deletedCount }
        };
    } catch (error) {
        console.error("Error in removeBulkContact service:", error);
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: resMessage.Server_error,
            error: error.message
        };
    }
};

exports.bulkBlockContact = async (req) => {
    const { ids } = req.body;
    const userId = req.user._id;
    const tenantId = req.tenant._id;
    const projectId = req.params.projectId;

    const checkProject = await Project.findOne({ _id: req.params.projectId, userId: req.user._id, tenantId: req.tenant._id });
    if (!checkProject) {
        return {
            status: statusCode.NOT_FOUND,
            success: false,
            message: resMessage.ProjectId_dont_exists,
            statusCode: statusCode.NOT_FOUND,
        }
    }

    if (!Array.isArray(ids) || ids.length === 0) {
        return {
            status: statusCode.BAD_REQUEST,
            success: false,
            message: resMessage.No_IDs_provided_for_updation,
            statusCode: statusCode.BAD_REQUEST
        };
    }

    try {
        const result = await Contact.updateMany({
            _id: { $in: ids },
            tenantId,
            userId,
            projectId
        }, { $set: { isBlocked: true } });

        if (result.matchedCount === 0) {
            return {
                status: statusCode.NOT_FOUND,
                success: false,
                message: resMessage?.No_contacts_found,
                statusCode: statusCode.NOT_FOUND
            };
        }

        return {
            status: statusCode.OK,
            success: true,
            message: resMessage.Bulk_update_successful,
            statusCode: statusCode.OK
        };
    } catch (error) {
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: resMessage.Server_error,
            error: error.message
        };
    }
};

exports.addCustomFieldToContacts = async (req) => {
  const { key, type } = req.body;
  const tenantId = req.tenant._id;
  const projectId = req.params.projectId;

  const allowedTypes = ["text", "number", "date", "boolean", "enum"];

  if (!key || !type) {
    return {
      status: 400,
      success: false,
      message: "Key and type are required",
    };
  }

  if (!allowedTypes.includes(type)) {
    return {
      status: 400,
      success: false,
      message: `Type '${type}' is not allowed. Allowed types: ${allowedTypes.join(", ")}`,
    };
  }

  const duplicate = await Contact.findOne({
    tenantId,
    projectId,
    [`customFields.${key}`]: { $exists: true },
  });


  if (duplicate) {
    return {
      status: 400,
      success: false,
      message: `Custom field '${key}' already exists in a contact under this tenant/project.`,
    };
  }
  
  let defaultValue = null;
  switch (type) {
    case "text":
      defaultValue = "";
      break;
    case "number":
      defaultValue = 0;
      break;
    case "boolean":
      defaultValue = false;
      break;
    case "enum":
    case "date":
      defaultValue = null;
      break;
  }


  const updateResult = await Contact.updateMany(
    {
      tenantId,
      projectId,
      [`customFields.${key}`]: { $exists: false },
    },
    {
      $set: {
        [`customFields.${key}`]: { value: defaultValue, type },
      },
    }
  );

  return {
    status: 200,
    success: true,
    message: `Custom field '${key}' added to all matching contacts.`,
  };
};

exports.fieldList = async (req) => {
  const tenantId = req.tenant._id;
  const projectId = req.params.projectId;
 
  try {
 
    const contacts = await Contact.find(
      { tenantId, projectId },
      {
        name: 1,
        email: 1,
        mobileNumber: 1,
        countryCode: 1,
        customFields: 1,
      }
    );
 
    // Default system fields mapping
    const defaultFields = [
      { key: "name", label: "Full Name", type: "text" },
      { key: "email", label: "Email Address", type: "email" },
      { key: "mobileNumber", label: "Phone Number", type: "tel" },
      { key: "countryCode", label: "Country Code", type: "text" }
    ];
 
    // Use a map to avoid duplicate custom fields
    const customFieldMap = new Map();
 
    contacts.forEach((contact, index) => {
      const customFields = contact.customFields || {};
 
      Object.entries(customFields).forEach(([key, value]) => {
        if (value && typeof value === 'object' && value.type && !customFieldMap.has(key)) {
          customFieldMap.set(key, {
            label: key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
            type: value.type
          });
        }
      });
    });
 
    const finalFields = [
      ...defaultFields.map(f => ({ label: f.label, type: f.type })),
      ...Array.from(customFieldMap.values())
    ];
 
    return {
      status: 200,
      success: true,
      message: "Field list fetched successfully",
      data: finalFields
    };
  } catch (error) {
    return {
      status: 500,
      success: false,
      message: "Failed to fetch field list",
      error: error.message
    };
  }
};

exports.bulkUnblockContact = async (req) => {
    const { ids } = req.body;
    const userId = req.user._id;
    const tenantId = req.tenant._id;
    const projectId = req.params.projectId;

    const checkProject = await Project.findOne({ _id: req.params.projectId, userId: req.user._id, tenantId: req.tenant._id });
    if (!checkProject) {
        return {
            status: statusCode.NOT_FOUND,
            success: false,
            message: resMessage.ProjectId_dont_exists,
            statusCode: statusCode.NOT_FOUND,
        }
    }

    if (!Array.isArray(ids) || ids.length === 0) {
        return {
            status: statusCode.BAD_REQUEST,
            success: false,
            message: resMessage.No_IDs_provided_for_updation,
            statusCode: statusCode.BAD_REQUEST
        };
    }

    try {
        const result = await Contact.updateMany({
            _id: { $in: ids },
            tenantId,
            userId,
            projectId
        }, { $set: { isBlocked: false } });

        if (result.matchedCount === 0) {
            return {
                status: statusCode.NOT_FOUND,
                success: false,
                message: resMessage?.No_contacts_found,
                statusCode: statusCode.NOT_FOUND
            };
        }

        return {
            status: statusCode.OK,
            success: true,
            message: resMessage.Bulk_update_successful,
            statusCode: statusCode.OK
        };
    } catch (error) {
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: resMessage.Server_error,
            error: error.message
        };
    }
};