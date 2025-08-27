import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";

function trimSlash(s = "") {
  return String(s).replace(/\/+$/g, ""); // remove trailing slashes
}
function trimLeadingSlash(s = "") {
  return String(s).replace(/^\/+/g, ""); // remove leading slashes
}

const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URL) {
      throw new Error("MONGODB_URL is not defined");
    }

    const host = trimSlash(process.env.MONGODB_URL);
    const dbName = trimLeadingSlash(DB_NAME || "");
    const mongoUri = `${host}/${dbName}`;

    console.log("Using Mongo URI:", mongoUri); // temporary debug log

    const connectionInstance = await mongoose.connect(mongoUri, {
      // Mongoose 6+ defaults are fine, but explicit is OK:
      // useNewUrlParser: true,
      // useUnifiedTopology: true,
    });

    console.log(`\n✅ MONGODB CONNECTED !! DB HOST: ${connectionInstance.connection.host}`);
  } catch (error) {
    console.error("❌ MONGODB CONNECTION FAILED: ", error);
    process.exit(1);
  }
};

export default connectDB;
