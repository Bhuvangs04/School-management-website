import mongoose from "mongoose";
import logger from "../utils/logger.js";

const connectDB = async () => {
    try {
        const uri = process.env.MONGO_URI;
        if (!uri) throw new Error("MONGO_URI missing");
        await mongoose.connect(uri, { dbName: "college_service" });
        logger.info("MongoDB connected");
    } catch (err) {
        logger.error("MongoDB connection error", err);
        process.exit(1);
    }
};

export default connectDB;
