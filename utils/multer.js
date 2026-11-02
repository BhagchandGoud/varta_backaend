import multer from "multer";

const storage = multer.memoryStorage();

const uploadFilesCloud = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, 
  },
  fileFilter: (_req, file, callback) => {
    const allowedTypes = /^(image|video|audio)\//;
    const allowedDocuments = ["application/pdf", "text/plain", "application/zip", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    if (allowedTypes.test(file.mimetype) || allowedDocuments.includes(file.mimetype)) return callback(null, true);
    const error = new Error("Unsupported upload type");
    error.code = "INVALID_FILE_TYPE";
    return callback(error);
  },
}).array("files", 10);


export default uploadFilesCloud;
