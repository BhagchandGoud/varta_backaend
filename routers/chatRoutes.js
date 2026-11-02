import express from 'express'
import { authentication} from '../middlewares/auth.js'
import { archiveChat, clearChat, deleteChat, getChatById, getOrCreateChat, getUserChats, muteChat, pinMessage, unarchiveChat, unmuteChat, unpinMessage } from '../controllers/chatController.js';
import {validateChatId} from '../middlewares/validateChatId.js'
import { validateObjectIdParam } from '../middlewares/security.js';
const router = express.Router();

router.use(authentication);

router.get('/create/:receiverId', validateObjectIdParam('receiverId'), getOrCreateChat);
router.get('/all-chats', getUserChats);
router.delete('/:chatId/messages', validateChatId, validateObjectIdParam('chatId'), clearChat);
router.patch('/:chatId/archive', validateChatId, validateObjectIdParam('chatId'), archiveChat);
router.patch('/:chatId/unarchive', validateChatId, validateObjectIdParam('chatId'), unarchiveChat);
router.patch('/:chatId/mute', validateChatId, validateObjectIdParam('chatId'), muteChat);
router.patch('/:chatId/unmute', validateChatId, validateObjectIdParam('chatId'), unmuteChat);
router.post('/:chatId/pin/:messageId', validateChatId, validateObjectIdParam('chatId'), validateObjectIdParam('messageId'), pinMessage);
router.delete('/:chatId/pin/:messageId', validateChatId, validateObjectIdParam('chatId'), validateObjectIdParam('messageId'), unpinMessage);
router.get('/:chatId' ,validateChatId, validateObjectIdParam('chatId'), getChatById);

router.delete('/:chatId',validateChatId, validateObjectIdParam('chatId'), deleteChat);

export default router;
