    // index.js
    import dotenv from "dotenv";
    import connectDB from "./db/db.js";
    import { app, gracefulShutdown } from "./app.js"; // <- named import

    dotenv.config({ path: "./.env" });

    connectDB()
    .then(() => {
        const port = process.env.PORT || 3000;
        const server = app.listen(port, () => {
        console.log(`Server is running at port: ${port}`);
        });

        // handle graceful shutdown signals
        const shutdown = gracefulShutdown(server);
        process.on("SIGINT", shutdown);
        process.on("SIGTERM", shutdown);
    })
    .catch((err) => {
        console.error("MONGODB CONNECTION FAILED!!!!!!", err);
    });
