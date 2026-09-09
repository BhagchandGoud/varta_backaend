import mongoose from 'mongoose'

export  const validateChatId = (req, res, next) => {
  const { chatId } = req.params;
  
  if (!chatId) {
    return res.status(400).json({
      success: false,
      message: 'Chat ID is required'
    });
  }
  
  if (!mongoose.Types.ObjectId.isValid(chatId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid chat ID format'
    });
  }
  
  next();
};