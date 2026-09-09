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
    updateContactDetails
    ,getBlockedContacts
} from '../controllers/userController.js';
import { authentication } from '../middlewares/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authentication);

router.get('/me', getCurrentUser);
router.get('/user/:userId', getUserById);
router.get('/all-users', getAllUsers);


// Search in contacts only 
router.get('/search/contacts', searchInContacts);
router.post('/search/contacts', searchInContacts);

// Search in blocked contacts only
router.get('/search/blocked', searchInBlocked);
router.post('/search/blocked', searchInBlocked);

// Search in suggestions 
router.get('/search/suggestions', searchInSuggestions);
router.post('/search/suggestions', searchInSuggestions);

// Legacy search (all users excluding contacts)
router.get('/search', search);
router.post('/search', search);


router.get('/contacts', getContacts);
router.get('/blocked', getBlockedContacts);
router.get('/requests', getRequests);
router.post('/send-request/:targetUserId' , sendRequest);
router.patch('/cancel-request/:requestId' , cancelRequest);
router.patch('/reject-request/:rejectRequestId' , rejectRequest);
router.patch('/add/:requestId', addToContacts);
router.delete('/contacts/remove/:contactId', removeFromContacts);
router.put('/contacts/block/:contactId', blockContact);
router.put('/contacts/unblock/:contactId', unblockContact);
router.patch('/contacts/:contactId', updateContactDetails);
router.post('/star/:messageId', toggleStarredMessage);


router.put('/profile', updateProfile);

export default router;
