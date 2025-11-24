import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import actionRoutes from "./routes/action.routes.js";
import connectDB from "./config/db.js";
import authRoutes from "./routes/auth.routes.js";
import io from "@pm2/io";
import { metrics } from "./metrics/pm2.metrics.js";
import MQService from "./services/mq.service.js";

io.metric({
    name: "Auth Service Status",
    value: () => "online"
});

dotenv.config();

const app = express();
connectDB();

app.use(morgan("dev"));
app.set('trust proxy', 1);


app.use(express.json());
app.use(cookieParser());
app.use(cors());
app.use(helmet());
app.set

const loginLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 5,
});
app.use("/auth/login", loginLimiter);
app.use("/auth/send-otp", loginLimiter);


app.use("/auth", authRoutes);
app.use("/auth", actionRoutes);


app.listen(process.env.PORT, async () => {
    console.log(`AUTH SERVICE RUNNING ON PORT ${process.env.PORT}`);
    await MQService.init();
});
