import mongoose from "mongoose";

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Auth Service: MongoDB Connected ✔");
    } catch (error) {
        console.error("MongoDB Error", error.message);
    }
};

export default connectDB;
