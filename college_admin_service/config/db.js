import mongoose from "mongoose";
import logger from "../utils/logger.js";

const connectDB = async () => {
    try {
        const uri = process.env.MONGO_URI;
        if (!uri) throw new Error("MONGO_URI missing");

        await mongoose.connect(uri, {
            dbName: "college_service",

            maxPoolSize: 50,                 // handle concurrency
            minPoolSize: 10,                 // keep warm connections
            serverSelectionTimeoutMS: 3000,  // fail fast if DB unreachable
            socketTimeoutMS: 45000,          // avoid hanging sockets
            maxIdleTimeMS: 30000,

            family: 4,                       // force IPv4 (DNS issues fix)
            retryWrites: true,
            compressors: ["snappy"],
        });

        logger.info("MongoDB connected");
    } catch (err) {
        logger.error("MongoDB connection error", err);
        process.exit(1);
    }
};

export default connectDB;
