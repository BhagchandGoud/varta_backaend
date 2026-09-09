import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

export const authentication = async(req, res, next)=>{
    try {
        let token = req.cookies.token;
        
        
        if (!token && req.headers.authorization) {
            token = req.headers.authorization.split(' ')[1];
        }
        
        if (!token) {
            return res.status(401).json({
                success: false, 
                message: "Unauthorized - No token provided"
            });
        }
        
        const decode = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decode;
        next();
        
    } catch (error) {
        return res.status(401).json({
            success: false, 
            message: "Invalid or expired token"
        });
    }
}