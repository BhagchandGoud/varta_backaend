import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import UserModel from '../models/UserModel.js';
import crypto from 'crypto';
import { getRedisJson, getRedisValue, setRedisJson } from '../utils/redisStore.js';
dotenv.config();

export const authentication = async(req, res, next)=>{
    let token;
    let decode;
    try {
        token = req.cookies.token;
        
        if (!token && req.headers.authorization) {
            token = req.headers.authorization.split(' ')[1];
        }
        
        if (!token) {
            return res.status(401).json({
                success: false, 
                message: "Unauthorized - No token provided"
            });
        }

        decode = jwt.verify(token, process.env.JWT_SECRET);
        const tokenKey = crypto.createHash('sha256').update(token).digest('hex');
        const sessionUserId = await getRedisValue(`session:${tokenKey}`);
        if (sessionUserId && sessionUserId !== String(decode.userId)) {
            return res.status(401).json({
                success: false,
                message: "Invalid session",
            });
        }
    } catch {
        return res.status(401).json({
            success: false,
            message: "Invalid or expired token"
        });
    }

    try {
        const cacheKey = `user:auth:${decode.userId}`;
        let user = await getRedisJson(cacheKey);
        if (!user) {
            user = await UserModel.findById(decode.userId).select(
                '_id role isSuspended',
            ).lean();
            if (user) await setRedisJson(cacheKey, user, 60);
        }
        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Account no longer exists",
            });
        }
        if (user.isSuspended) {
            return res.status(403).json({
                success: false,
                message: "This account has been suspended",
            });
        }
        req.user = { ...decode, role: user.role };
        next();
    } catch (error) {
        next(error);
    }
};

export const requireAdmin = (req, res, next) => {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: "Administrator access required",
        });
    }
    next();
}