import DataUriParser from "datauri/parser.js";
import path from "path";

const getDataUrl = (file) => {
  const parser = new DataUriParser();

  const extName = path.extname(file.originalname).toString();
  const result = parser.format(extName, file.buffer);
  return result;
};

export default getDataUrl;
