const getDataUrl = (file) => {
  const mimeType = file.mimetype || "application/octet-stream";
  return {
    content: `data:${mimeType};base64,${file.buffer.toString("base64")}`,
    type: mimeType,
  };
};

export default getDataUrl;
