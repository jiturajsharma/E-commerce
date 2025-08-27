    // models/Auction.js
    import mongoose from "mongoose";

    const STATUS = ["upcoming", "live", "ended", "cancelled"];

    const auctionSchema = new mongoose.Schema(
    {
        name: {
        type: String,
        required: [true, "Auction name is required"],
        trim: true,
        maxlength: 150,
        },

        description: {
        type: String,
        required: [true, "Auction description is required"],
        trim: true,
        maxlength: 2000,
        },

        category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ProductCategory",
        required: [true, "Category is required"],
        index: true,
        },

        seller: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: [true, "Seller is required"],
        index: true,
        },

        startTime: { type: Date, required: [true, "Start time is required"], index: true },
        endTime: { type: Date, required: [true, "End time is required"], index: true },

        bids: [{ type: mongoose.Schema.Types.ObjectId, ref: "Bid" }],

        // winner references a bid (not a user) — store the winning Bid's id
        winner: { type: mongoose.Schema.Types.ObjectId, ref: "Bid", default: null, select: false },

        status: {
        type: String,
        enum: STATUS,
        default: "upcoming",
        index: true,
        },

        location: { type: mongoose.Schema.Types.ObjectId, ref: "City", index: true },

        image: {
        type: String,
        required: [true, "Auction image is required"],
        trim: true,
        default: "https://via.placeholder.com/600x400",
        },

        startingPrice: {
        type: Number,
        required: [true, "Starting price is required"],
        min: [0, "Starting price cannot be negative"],
        },

        reviews: [{ type: mongoose.Schema.Types.ObjectId, ref: "Review" }],

        paid: {
        type: Boolean,
        default: false,
        index: true,
        },
    },
    {
        timestamps: true,
        versionKey: false,
        toJSON: {
        virtuals: true,
        transform: (_doc, ret) => {
            // remove internal-only fields
            delete ret.__v;
            return ret;
        },
        },
        toObject: { virtuals: true },
    }
    );

    /** Validation: endTime must be after startTime */
    auctionSchema.pre("validate", function (next) {
    if (this.startTime && this.endTime && this.endTime <= this.startTime) {
        return next(new Error("endTime must be greater than startTime"));
    }
    next();
    });

    /** Virtual: isLive (computed) */
    auctionSchema.virtual("isLive").get(function () {
    const now = Date.now();
    return this.startTime && this.endTime && now >= this.startTime.getTime() && now <= this.endTime.getTime();
    });

    /** Instance helper: return simplified auction summary */
    auctionSchema.methods.summary = function () {
    return {
        id: this._id,
        name: this.name,
        startingPrice: this.startingPrice,
        status: this.status,
        startTime: this.startTime,
        endTime: this.endTime,
        isLive: this.isLive,
    };
    };

    /**
     * Static helper: safely transition statuses.
     * Example usage: Auction.transitionStatus(auctionId, "ended")
     */
    auctionSchema.statics.transitionStatus = async function (auctionId, newStatus) {
    if (!STATUS.includes(newStatus)) throw new Error("Invalid auction status");
    return this.findByIdAndUpdate(auctionId, { status: newStatus }, { new: true });
    };

    /** Indexes for common queries */
    auctionSchema.index({ seller: 1, status: 1, startTime: -1 });
    auctionSchema.index({ category: 1, startTime: -1 });

    // Prevent model overwrite in dev/hot-reload
    const Auction = mongoose.models.Auction || mongoose.model("Auction", auctionSchema);

    export default Auction;
