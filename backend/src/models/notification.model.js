    // models/Notification.js
    import mongoose from "mongoose";

    const NOTIFICATION_TYPES = ["bid", "auction", "system", "payment", "review"];

    const notificationSchema = new mongoose.Schema(
    {
        user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
        },

        message: {
        type: String,
        required: true,
        trim: true,
        maxlength: 500,
        },

        type: {
        type: String,
        required: true,
        enum: NOTIFICATION_TYPES,
        index: true,
        },

        auction: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Auction",
        default: null,
        },

        isRead: {
        type: Boolean,
        default: false,
        index: true,
        },

        link: {
        type: String,
        required: true,
        trim: true,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
    );

    /** Helper: mark notification as read */
    notificationSchema.methods.markAsRead = async function () {
    this.isRead = true;
    return this.save();
    };

    /** Static: get unread notifications for a user */
    notificationSchema.statics.getUnreadByUser = function (userId) {
    return this.find({ user: userId, isRead: false }).sort({ createdAt: -1 });
    };

    /** Index for user + unread combo */
    notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });

    // Hot-reload safe export
    const Notification =
    mongoose.models.Notification || mongoose.model("Notification", notificationSchema);

    export default Notification;
