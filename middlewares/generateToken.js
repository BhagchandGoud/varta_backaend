import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { setRedisValue } from '../utils/redisStore.js';
dotenv.config();

export const generateToken = async(userId, res)=>{
    const token = jwt.sign(
        { userId }, 
        process.env.JWT_SECRET, 
        { expiresIn: "30d" }
    );

    
    res.cookie('token', token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 30 * 24 * 60 * 60 * 1000,
        path: '/'
    });

    const tokenKey = crypto.createHash('sha256').update(token).digest('hex');
    await setRedisValue(`session:${tokenKey}`, String(userId), 30 * 24 * 60 * 60);
    
    return token;
}