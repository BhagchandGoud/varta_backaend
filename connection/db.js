import mongoose from "mongoose";
import dotenv from 'dotenv'
dotenv.config();

const dbConnection = async()=>{
    if (!process.env.DB_CONNECTION) {
        process.exit(1);
    }
    try {
        const response = await mongoose.connect(process.env.DB_CONNECTION);
    } catch (error) {
        process.exit(1);
    }
}

export default dbConnection;