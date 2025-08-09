const { statusCode, resMessage } = require("../config/constants");
const { getBusinessData, createProductCatalog } = require('../functions/functions');
const Catalog = require('../models/Catalog');

exports.create = async (req) => {
    try {
        const { metaBusinessId } = req.params;
        const { accessToken } = req.query;
        const { name } = req.body;
        const checkMetaId = await getBusinessData(metaBusinessId, accessToken);
        if(checkMetaId?.error) {
            return {
                status: statusCode.BAD_REQUEST,
                success: false,
                message: checkMetaId?.error?.message
            }
        }
        const data = await createProductCatalog(metaBusinessId, name, accessToken);
        if(data?.error) {
            return {
                status: statusCode.BAD_REQUEST,
                success: false,
                message: data?.error?.message
            }
        }
        await Catalog.create({
            userId: req.user._id,
            tenantId: req.tenant._id,
            metaId: checkMetaId.id,
            name,
            accessToken
        })
        return {
            status: statusCode.CREATED,
            success: true,
            message: resMessage.Catalog_created
        }
    } catch (error) {
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: error.message
        };
    }
}