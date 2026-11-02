import express from 'express';
import { login, register, logout, verification, resendOTP, forgotPassword, resetPassword } from '../controllers/authController.js';
import { authentication } from '../middlewares/auth.js';
import { authLimiter, otpLimiter, validateBody } from '../middlewares/security.js';

const router = express.Router();

router.post('/register', authLimiter, validateBody('register'), register);
router.post('/login', authLimiter, validateBody('login'), login);
router.post('/logout', authentication, logout);
router.post('/resend-otp', otpLimiter, validateBody('forgotPassword'), resendOTP);
router.post('/verify-otp', otpLimiter, validateBody('otp'), verification);
router.post('/forgot-password', otpLimiter, validateBody('forgotPassword'), forgotPassword);
router.post('/reset-password/:token', otpLimiter, validateBody('resetPassword'), resetPassword);

export default router;