// const multer = require('multer');
// const path = require('path');
// const fs = require('fs'); // Node.js file system module

// // Ensure the uploads directory for media exists
// const mediaUploadDir = path.join(__dirname, '../uploads/media');
// if (!fs.existsSync(mediaUploadDir)) {
//     fs.mkdirSync(mediaUploadDir, { recursive: true });
// }

// // Set up storage for uploaded media files
// const storage = multer.diskStorage({
//     destination: (req, file, cb) => {
//         cb(null, mediaUploadDir); // Store in server/uploads/media
//     },
//     filename: (req, file, cb) => {
//         cb(null, `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`);
//     }
// });

// const mediaUpload = multer({
//     storage: storage,
//     limits: { fileSize: 1024 * 1024 * 25 }, // 25MB file size limit for media
//     fileFilter: (req, file, cb) => {
//         const allowedMimeTypes = /jpeg|jpg|png|gif|mp4|mov|avi|pdf|doc|docx/; // Common media types
//         const mimeTypeTest = allowedMimeTypes.test(file.mimetype);
//         const extNameTest = allowedMimeTypes.test(path.extname(file.originalname).toLowerCase());

//         if (mimeTypeTest && extNameTest) {
//             return cb(null, true);
//         } else {
//             cb(new Error('Invalid file type. Only images, videos, documents (pdf, doc, docx) are allowed!'), false);
//         }
//     }
// });

// module.exports = mediaUpload;



const multer = require('multer');
const path = require('path');
const fs = require('fs');

const mediaUploadDir = path.join(__dirname, '../uploads/media');
if (!fs.existsSync(mediaUploadDir)) {
    fs.mkdirSync(mediaUploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, mediaUploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, `file-${Date.now()}${path.extname(file.originalname)}`);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'application/pdf',
        'audio/mpeg',
        'audio/mp3',
        'audio/wav',
        'video/mp4',
        'video/webm',
        'video/quicktime',
    ];

    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only images, PDFs, audio, and videos are allowed!'), false);
    }
};

module.exports = multer({
    storage: storage,
    limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit
    fileFilter: fileFilter
});
