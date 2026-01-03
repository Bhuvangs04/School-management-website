import express from "express";
import dotenv from "dotenv";
import morgan from "morgan";
import helmet from "helmet";
import cors from "cors";
import connectDB from "./config/db.js";
import logger from "./utils/logger.js";
import rabbitMQ from "./utils/rabbitmq.js";
import collegeRoutes from "./routes/college.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import departmentRoutes from "./routes/department.routes.js"
import errorHandler from "./middleware/errorHandler.js";
import MQService from "./services/mq.service.js";
import { requestLogger } from "./middleware/requestLogger.js"

import fs from "fs";
import { initCollegeConsumers } from "./consumers/college.consumer.js";



dotenv.config();

const app = express();

// Security Middleware
app.use(helmet());
app.use(cors());

// Request Parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging
if (process.env.NODE_ENV !== "production") {
    app.use(morgan("dev"));
}

// Database Connection
await connectDB();

// RabbitMQ Connection
await MQService.init();


// start consumers AFTER MQ is ready
await initCollegeConsumers();


app.use(requestLogger);


// Routes
app.get("/health", (req, res) => res.json({ ok: true }));
app.use("/api/college", collegeRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/department", departmentRoutes);

// Directories
const uploadDir = process.env.UPLOAD_DIR || "./uploads";
const reportDir = process.env.REPORT_DIR || "./reports";
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });

// Global Error Handler
app.use(errorHandler);

const PORT = process.env.PORT || 5002;
const server = app.listen(PORT, () => {
    logger.info(`College Service listening on ${PORT}`);
});

// Graceful Shutdown
const shutdown = async () => {
    logger.info("Shutting down server...");
    server.close(() => {
        logger.info("HTTP server closed");
    });

    try {
        await mongoose.connection.close();
        logger.info("MongoDB connection closed");
        // Close RabbitMQ connection if exposed, or rely on process exit
        // await rabbitMQ.close(); 
        process.exit(0);
    } catch (err) {
        logger.error("Error during shutdown", err);
        process.exit(1);
    }
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
