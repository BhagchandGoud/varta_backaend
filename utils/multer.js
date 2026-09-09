import multer from "multer";

const storage = multer.memoryStorage();

const uploadFilesCloud = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, 
  },
}).array("files", 10);


export default uploadFilesCloud;
