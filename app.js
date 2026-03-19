import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { clerkMiddleware } from "@clerk/express";

import {
  CLERK_AUTHORIZED_PARTIES,
  CLERK_JWT_KEY,
  CORS_ORIGINS,
  PORT,
} from "./config/env.js";
import connectDB from "./database/mongodb.js";

import errorMiddleware from "./middlewares/error.middleware.js";

import userRouter from "./routes/user.route.js";
import authRouter from "./routes/auth.route.js";
import workflowRouter from "./routes/workflow.route.js";
import subscriptionRouter from "./routes/subscription.route.js";
import webhookRouter from "./routes/webhook.route.js";

const app = express();

const parseCsvEnv = (value) =>
  value
    ?.split(",")
    .map((entry) => entry.trim())
    .filter(Boolean) || [];

const allowedOrigins = parseCsvEnv(CORS_ORIGINS);
const authorizedParties = parseCsvEnv(CLERK_AUTHORIZED_PARTIES);
const clerkOptions = {};

if (authorizedParties.length) {
  clerkOptions.authorizedParties = authorizedParties;
}

if (CLERK_JWT_KEY) {
  clerkOptions.jwtKey = CLERK_JWT_KEY;
}

app.use(clerkMiddleware(clerkOptions));
app.use(
  cors({
    origin: allowedOrigins.length
      ? (origin, callback) => callback(null, !origin || allowedOrigins.includes(origin))
      : true,
    allowedHeaders: ["Authorization", "Content-Type"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  })
);
app.use(cookieParser());

app.use("/api/v1", async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    next(error);
  }
});

app.use(
  "/api/v1/webhooks/clerk",
  express.raw({ type: "application/json" }),
  webhookRouter
);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/users", userRouter);
app.use("/api/v1/subscriptions", subscriptionRouter);
app.use("/api/v1/workflows", workflowRouter);

app.get("/", (req, res) => res.send("Hello World!"));
app.use(errorMiddleware);

if (!process.env.VERCEL) {
  app.listen(PORT, async () => {
    console.log(`🚀 App listening on the port ${PORT}`);
    try {
      await connectDB();
    } catch (error) {
      console.error("MongoDB connection error:", error.message);
      process.exit(1);
    }
  });
}

export default app;
