import mongoose from "mongoose";
import logger from "../utils/logger";

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            maxPoolSize: 50,                // handle concurrency
            minPoolSize: 10,                // keep warm connections
            serverSelectionTimeoutMS: 3000, // fail fast if DB unreachable
            socketTimeoutMS: 45000,         // avoid random socket disconnects
            maxIdleTimeMS: 30000,
            family: 4,                      // force IPv4 (fixes DNS delay sometimes)
            retryWrites: true,
            compressors: ['snappy']
        });
        logger.info("Auth Service: MongoDB Connected ✔");
    } catch (error) {
        logger.error("MongoDB Error", error.message);
    }
};

export default connectDB;
