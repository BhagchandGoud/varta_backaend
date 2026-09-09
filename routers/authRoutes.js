import express from 'express';
import { login, register, logout, verification, resendOTP, forgotPassword, resetPassword } from '../controllers/authController.js';
import { authentication } from '../middlewares/auth.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/logout', authentication, logout);
router.post('/resend-otp', resendOTP);
router.post('/verify-otp', verification);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);

export default router;