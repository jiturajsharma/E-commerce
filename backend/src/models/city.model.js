    // models/City.js
    import mongoose from "mongoose";

    const citySchema = new mongoose.Schema(
    {
        name: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        unique: true, // optional: ensures no duplicate city names
        maxlength: 100,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
    );

    // Prevent model overwrite in development (hot-reload safe)
    const City = mongoose.models.City || mongoose.model("City", citySchema);

    export default City;
