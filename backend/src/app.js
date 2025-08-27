import cors from "cors";
import express from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import morgan from "morgan";
import createError from "http-errors";
import "./cronJobs.js"

const app = express();

/**
 * Config
 * - Configure allowed origins in env or fallback list
 */
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "http://localhost:5173,https://e-bid-x.vercel.app")
  .split(",")
  .map((s) => s.trim());

/**
 * Security: HTTP headers
 */
app.use(helmet());

/**
 * CORS: whitelist-based and supports cookies (credentials)
 */
app.use(
  cors({
    origin: (origin, callback) => {
      // allow non-browser requests like Postman (no origin)
      if (!origin) return callback(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      return callback(new Error(`CORS policy: Access denied for origin ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "DELETE", "PUT", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

/**
 * Logging: use morgan in dev for concise request logs
 */
if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
}

/**
 * Rate limiting: basic protection against brute force / DDoS
 */
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: Number(process.env.RATE_LIMIT_MAX) || 100, // limit each IP
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

/**
 * Body & cookie parsing
 */
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(cookieParser());

/**
 * Static assets
 */
app.use(express.static("public"));

/**
 * Route imports
 * (Keep these relative paths as in your project)
 */
import userRouter from "./routes/user.routes.js";
import productCategoryRouter from "./routes/productCategory.routes.js";
import auctionRouter from "./routes/auction.routes.js";
import cityRouter from "./routes/city.routes.js";
import bidRouter from "./routes/bid.routes.js";
import notificationRouter from "./routes/notification.routes.js";
import paymentRouter from "./routes/payment.routes.js";
import cartRouter from "./routes/cart.routes.js";

/**
 * API routes
 */
app.use("/api/v1/users", userRouter);
app.use("/api/v1/product-categories", productCategoryRouter);
app.use("/api/v1/auctions", auctionRouter);
app.use("/api/v1/cities", cityRouter);
app.use("/api/v1/bids", bidRouter);
app.use("/api/v1/notifications", notificationRouter);
app.use("/api/v1/payments", paymentRouter);
app.use("/api/v1/cart", cartRouter);

/**
 * Health check
 */
app.get("/", (req, res) => {
  res.status(200).send("E-bidX backend is running 🚀");
});

/**
 * 404 handler for unknown routes
 */
app.use((req, res, next) => {
  next(createError(404, "Not Found"));
});

/**
 * Centralized error handler
 * - returns consistent JSON structure in production & dev-friendly errors in local
 */
app.use((err, req, res, next) => {
  /* eslint-disable no-console */
  console.error(err.stack || err);

  const status = err.status || 500;
  const message =
    process.env.NODE_ENV === "production" ? err.message || "Internal Server Error" : err.message;

  res.status(status).json({
    status,
    message,
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
  });
  /* eslint-enable no-console */
});

/**
 * Graceful shutdown helper (exported for server file to call)
 */
function gracefulShutdown(server) {
  return () => {
    console.log("Received shutdown signal, closing server gracefully...");
    server.close(() => {
      console.log("HTTP server closed.");
      // close DB connections here if needed
      process.exit(0);
    });

    // force exit after timeout
    setTimeout(() => {
      console.error("Could not close connections in time, forcing shutdown");
      process.exit(1);
    }, 10_000);
  };
}

export  { app, gracefulShutdown };
