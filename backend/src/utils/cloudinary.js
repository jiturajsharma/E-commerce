    // utils/cloudinary.js
    import { v2 as cloudinary } from "cloudinary";
    import fs from "fs";
    import path from "path";
    import dotenv from "dotenv";

    dotenv.config();

    if (!process.env.CLOUDINARY_CLOUD_NAME ||
        !process.env.CLOUDINARY_API_KEY ||
        !process.env.CLOUDINARY_API_SECRET) {
    throw new Error("Cloudinary env vars are missing. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET");
    }

    cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    /**
     * Upload a local file to Cloudinary.
     * @param {string} localFilePath - path to file on disk
     * @param {object} opts - cloudinary upload options
     *   { folder, resource_type, public_id, use_filename, unique_filename }
     * @returns {Promise<object|null>} Cloudinary upload response or null on failure
     */
    export const uploadOnCloudinary = async (localFilePath, opts = {}) => {
    if (!localFilePath) return null;

    const {
        folder = "uploads",
        resource_type = "auto",
        use_filename = true,
        unique_filename = true,
        public_id, // optional custom name without extension
        overwrite = false,
    } = opts;

    try {
        const response = await cloudinary.uploader.upload(localFilePath, {
        folder,
        resource_type,
        use_filename,
        unique_filename,
        public_id,
        overwrite,
        invalidate: true,
        });

        // best-effort cleanup
        safeUnlink(localFilePath);
        return response;
    } catch (err) {
        console.error("[Cloudinary] Upload failed:", err?.message || err);
        safeUnlink(localFilePath);
        return null;
    }
    };

    /**
     * Delete an asset from Cloudinary by public_id.
     * @param {string} publicId - e.g., "uploads/abc123"
     * @param {string} resourceType - "image" | "video" | "raw"
     * @returns {Promise<object|null>}
     */
    export const deleteFromCloudinary = async (publicId, resourceType = "image") => {
    if (!publicId) return null;
    try {
        const res = await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType,
        invalidate: true,
        });
        return res;
    } catch (err) {
        console.error("[Cloudinary] Delete failed:", err?.message || err);
        return null;
    }
    };

    /** Safely remove a local file without throwing */
    function safeUnlink(filePath) {
    try {
        if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (e) {
        console.warn("[Cloudinary] Could not remove temp file:", path.basename(filePath));
    }
    }
