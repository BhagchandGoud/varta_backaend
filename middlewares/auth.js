import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import UserModel from '../models/UserModel.js';
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
    } catch {
        return res.status(401).json({
            success: false,
            message: "Invalid or expired token"
        });
    }

    try {
        const user = await UserModel.findById(decode.userId).select(
            '_id role isSuspended',
        );
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