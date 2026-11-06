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

        const indexes = await mongoose.connection.db.collection("users").indexes();
        if (indexes.some((index) => index.name === "phone_1")) {
            await mongoose.connection.db.collection("users").dropIndex("phone_1");
            console.log("[db] removed obsolete unique phone index");
        }
    } catch (error) {
        throw new Error(`MongoDB connection failed: ${error.message}`);
    }
}

export default dbConnection;