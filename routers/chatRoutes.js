import express from 'express'
import { authentication} from '../middlewares/auth.js'
import { archiveChat, clearChat, deleteChat, getChatById, getOrCreateChat, getUserChats, muteChat, pinMessage, unarchiveChat, unmuteChat, unpinMessage } from '../controllers/chatController.js';
import {validateChatId} from '../middlewares/validateChatId.js'
const router = express.Router();

router.use(authentication);

router.get('/create/:receiverId', getOrCreateChat);
router.get('/all-chats', getUserChats);
router.delete('/:chatId/messages', validateChatId, clearChat);
router.patch('/:chatId/archive', validateChatId, archiveChat);
router.patch('/:chatId/unarchive', validateChatId, unarchiveChat);
router.patch('/:chatId/mute', validateChatId, muteChat);
router.patch('/:chatId/unmute', validateChatId, unmuteChat);
router.post('/:chatId/pin/:messageId', validateChatId, pinMessage);
router.delete('/:chatId/pin/:messageId', validateChatId, unpinMessage);
router.get('/:chatId' ,validateChatId, getChatById);

router.delete('/:chatId',validateChatId , deleteChat);

export default router;
