const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure the uploads directory exists
const uploadDir = path.join(__dirname, '../uploads/excel');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Set up storage for uploaded files
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`);
    }
});

const uploadExcel = multer({
    storage: storage,
    limits: { fileSize: 1024 * 1024 * 5 }, // 5MB
    fileFilter: (req, file, cb) => {
        const allowedExtensions = /xlsx|xls|csv/;
        const extNameTest = allowedExtensions.test(path.extname(file.originalname).toLowerCase());

        const mimetypes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
            'application/vnd.ms-excel', // .xls
            'text/csv' // .csv
        ];

        const mimetype = mimetypes.includes(file.mimetype);

        if (mimetype && extNameTest) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only Excel (xlsx, xls) and CSV files are allowed!'), false);
        }
    }
});

module.exports = uploadExcel;
