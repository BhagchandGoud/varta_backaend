import express from 'express';
import {
    getAllUsers,
    getUserById,
    getCurrentUser,
    addToContacts,
    removeFromContacts,
    blockContact,
    unblockContact,
    updateProfile,
    updateSettings,
    searchInContacts,
    searchInBlocked,
    getContacts,
    getRequests,
    searchInSuggestions,
    search,
    sendRequest,
    cancelRequest,
    rejectRequest,
    toggleStarredMessage,
    updateContactDetails,
    getBlockedContacts,
    deleteAccount
} from '../controllers/userController.js';
import { authentication } from '../middlewares/auth.js';
import { searchLimiter, validateBody, validateObjectIdParam } from '../middlewares/security.js';

const router = express.Router();

// All routes require authentication
router.use(authentication);

router.get('/me', getCurrentUser);
router.delete('/me', deleteAccount);
router.get('/user/:userId', validateObjectIdParam('userId'), getUserById);
router.get('/all-users', getAllUsers);


// Search in contacts only 
router.get('/search/contacts', searchLimiter, searchInContacts);
router.post('/search/contacts', searchLimiter, searchInContacts);

// Search in blocked contacts only
router.get('/search/blocked', searchLimiter, searchInBlocked);
router.post('/search/blocked', searchLimiter, searchInBlocked);

// Search in suggestions 
router.get('/search/suggestions', searchLimiter, searchInSuggestions);
router.post('/search/suggestions', searchLimiter, searchInSuggestions);

// Legacy search (all users excluding contacts)
router.get('/search', searchLimiter, search);
router.post('/search', searchLimiter, search);


router.get('/contacts', getContacts);
router.get('/blocked', getBlockedContacts);
router.get('/requests', getRequests);
router.post('/send-request/:targetUserId' , validateObjectIdParam('targetUserId'), sendRequest);
router.patch('/cancel-request/:requestId' , cancelRequest);
router.patch('/reject-request/:rejectRequestId' , rejectRequest);
router.patch('/add/:requestId', addToContacts);
router.delete('/contacts/remove/:contactId', removeFromContacts);
router.put('/contacts/block/:contactId', blockContact);
router.put('/contacts/unblock/:contactId', unblockContact);
router.patch('/contacts/:contactId', validateObjectIdParam('contactId'), validateBody('contactDetails'), updateContactDetails);
router.post('/star/:messageId', validateObjectIdParam('messageId'), toggleStarredMessage);


router.put('/profile', validateBody('profile'), updateProfile);
router.patch('/settings', updateSettings);

export default router;
