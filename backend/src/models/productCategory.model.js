    import mongoose from "mongoose";

    const productCategorySchema = new mongoose.Schema(
    {
        name: {
        type: String,
        required: true,
        trim: true,
        unique: true, // prevents duplicate categories
        maxlength: 100,
        },
        description: {
        type: String,
        trim: true,
        maxlength: 500,
        },
        imageUrl: {
        type: String,
        trim: true,
        default: "https://via.placeholder.com/150", // fallback image
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
    );

    // Prevent model overwrite in development (hot-reload safe)
    const ProductCategory =
    mongoose.models.ProductCategory ||
    mongoose.model("ProductCategory", productCategorySchema);

    export default ProductCategory;
