const responseHandler = (fn) => async (req, res, next) => {
    try {
        const result = await fn(req);
 
        if (result.raw) {
            if (result.status) res.status(result.status);
            res.send(result.body);
        } else {
            const responsePayload = {
                status: result.status,
                success: result.success,
                message: result.message,
                data: result.data
            };
 
            if (result.pagination) {
                responsePayload.pagination = result.pagination;
            }
 
            res.status(result.status || 200).json(responsePayload);
        }
    } catch (error) {
        console.error("Error in response handler:", error);
        res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: error.message
        });
    }
};
 
module.exports = {responseHandler};
