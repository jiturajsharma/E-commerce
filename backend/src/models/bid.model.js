    import mongoose from "mongoose";

    const bidSchema = new mongoose.Schema(
    {
        bidder: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: [true, "Bidder is required"],
        index: true,
        },

        auction: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Auction",
        required: [true, "Auction reference is required"],
        index: true,
        },

        bidAmount: {
        type: Number,
        required: [true, "Bid amount is required"],
        min: [1, "Bid amount must be at least 1"],
        },

        bidTime: {
        type: Date,
        default: Date.now,
        index: true,
        },

        isWinningBid: {
        type: Boolean,
        default: false,
        index: true,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
    );

    /** Indexes for performance */
    bidSchema.index({ auction: 1, bidAmount: -1 }); // fast lookup of highest bids per auction
    bidSchema.index({ bidder: 1, auction: 1 }); // prevent duplicate same bidder+auction

    /** Ensure a bidder can’t place two identical bids in the same auction */
    bidSchema.index({ bidder: 1, auction: 1, bidAmount: 1 }, { unique: true });

    /** Instance method: check if this bid beats a given amount */
    bidSchema.methods.beats = function (amount) {
    return this.bidAmount > amount;
    };

    /** Static method: get the highest bid for an auction */
    bidSchema.statics.getHighestBid = async function (auctionId) {
    return this.findOne({ auction: auctionId })
        .sort({ bidAmount: -1, bidTime: 1 }) // higher first, earlier wins ties
        .populate("bidder", "fullName email profilePicture")
        .exec();
    };

    /** Hot-reload safe export */
    const Bid = mongoose.models.Bid || mongoose.model("Bid", bidSchema);

    export default Bid;
