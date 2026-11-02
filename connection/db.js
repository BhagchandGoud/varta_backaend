import mongoose from "mongoose";
import dns from 'dns'
import dotenv from 'dotenv'
dotenv.config();


dns.setServers(['1.1.1.1' , '8.8.8.8']);

const dbConnection = async()=>{
    if (!process.env.DB_CONNECTION) {
        throw new Error("DB_CONNECTION environment variable is not set");
    }
    try {
        await mongoose.connect(process.env.DB_CONNECTION);
    } catch (error) {
        throw new Error(`MongoDB connection failed: ${error.message}`);
    }
}

export default dbConnection;