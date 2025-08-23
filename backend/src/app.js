import express from "express";
import cors from 'cors';
import cookieParser from "cookie-parser";

const app = express();

app.use(
    cors({
      origin: process.env.CORS_ORIGIN, // Allowed origin from environment variable
      methods: ["GET", "POST", "DELETE", "PUT"], // Specific HTTP methods allowed
        allowedHeaders: [
        "Content-Type",
        "Authorization",
        "Cache-Control",
        "Expires",
        "Pragma",
      ], // Specific headers allowed
      credentials: true, // Allow credentials like cookies
    })
);

app.use(express.json({limit: "20kb"}))
app.use(express.urlencoded({extended: true, limit: "16kb"}))
app.use(express.static("public"));
app.use(cookieParser())



export default app;