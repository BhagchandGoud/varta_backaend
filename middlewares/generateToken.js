import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
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
        secure: false,
        maxAge: 30 * 24 * 60 * 60 * 1000,
        path: '/'
    });
    
    return token;
}