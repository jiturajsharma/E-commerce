    // models/User.js
    import mongoose from "mongoose";
    import jwt from "jsonwebtoken";
    import bcrypt from "bcryptjs";


    const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS || 12);

    const userSchema = new mongoose.Schema(
        {
        fullName: {
            type: String,
            required: true,
            trim: true,
            maxlength: 120,
        },

        password: {
            type: String,
            required: true,
            minlength: 8,
            trim: true,
            // never select by default; expose via +password if needed
            select: false,
        },

        email: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            lowercase: true,
            index: true,
            validate: {
                validator: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
                message: "Invalid email address.",
            },
        },

        location: { type: String, trim: true },

        userType: {
            type: String,
            enum: ["user", "admin", "moderator", "seller"],
            default: "user",
            index: true,
        },

        resetToken: { type: String, select: false },
        resetTokenExpire: { type: Date, select: false },

        profilePicture: {
            type: String,
            default:
                "https://res.cloudinary.com/dnsxaor2k/image/upload/v1721403078/r4s3ingo0ysqq5hzsqal.jpg",
            trim: true,
        },

        phone: {
            type: String,
            trim: true,
            validate: {
            // Very permissive: digits, space, +, -, parentheses
            validator: (v) => !v || /^[\d\s()+-]{6,20}$/.test(v),
            message: "Invalid phone number.",
            },
        },

        address: { type: String, trim: true },
        city: { type: String, trim: true },

        gender: {
            type: String,
            enum: ["male", "female", "other", "prefer_not_to_say"],
            default: "prefer_not_to_say",
        },

        description: { type: String, trim: true, maxlength: 1000 },

        paymentVerified: { type: Boolean, default: false },

        products: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
        bids: [{ type: mongoose.Schema.Types.ObjectId, ref: "Bid" }],
        auctions: [{ type: mongoose.Schema.Types.ObjectId, ref: "Auction" }],
        transactions: [
            { type: mongoose.Schema.Types.ObjectId, ref: "Transaction" },
        ],
        reviews: [{ type: mongoose.Schema.Types.ObjectId, ref: "Review" }],
        notifications: [
            { type: mongoose.Schema.Types.ObjectId, ref: "Notification" },
        ],
        },
        {
        timestamps: true,
        versionKey: false,
        toJSON: {
            virtuals: true,
            transform: (_doc, ret) => {
            // Remove sensitive/internal fields
            delete ret.password;
            delete ret.resetToken;
            delete ret.resetTokenExpire;
            return ret;
            },
        },
        toObject: {
            virtuals: true,
            transform: (_doc, ret) => {
            delete ret.password;
            delete ret.resetToken;
            delete ret.resetTokenExpire;
            return ret;
            },
        },
        }
    );

    /** Instance Methods */

    // Compare raw password to hashed password.
    // Note: since password is select:false, ensure you've selected it when needed.
    userSchema.methods.comparePassword = async function comparePassword(
        enteredPassword
    ) {
        if (!this.password) return false;
        return bcrypt.compare(enteredPassword, this.password);
    };

    // Generate a signed JWT access token.
    userSchema.methods.generateJwtToken = function generateJwtToken() {
        if (!process.env.JWT_SECRET) {
        throw new Error("JWT_SECRET is not set");
        }
        const payload = {
        _id: this._id.toString(),
        fullName: this.fullName,
        email: this.email,
        location: this.location,
        userType: this.userType,
        };
        return jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || "15m",
        });
    };

    // Create a short-lived reset token (JWT-based).
    userSchema.methods.generateResetToken = function generateResetToken() {
    if (!process.env.RESET_TOKEN_SECRET) {
        throw new Error("RESET_TOKEN_SECRET is not set");
    }
    const token = jwt.sign(
        { _id: this._id.toString() },
        process.env.RESET_TOKEN_SECRET,
        { expiresIn: "10m" }
    );
    this.resetToken = token;
    this.resetTokenExpire = new Date(Date.now() + 10 * 60 * 1000);
    return token;
    };

    // Verify a provided reset token using the configured secret.
    userSchema.methods.verifyResetToken = function verifyResetToken(token) {
    if (!process.env.RESET_TOKEN_SECRET) {
        throw new Error("RESET_TOKEN_SECRET is not set");
    }
    try {
        const decoded = jwt.verify(token, process.env.RESET_TOKEN_SECRET);
        return decoded && decoded._id === this._id.toString();
    } catch {
        return false;
    }
    };

    /** Middleware */

    // Hash password before saving (only if modified).
    userSchema.pre("save", async function preSave(next) {
    try {
        if (!this.isModified("password")) return next();
        this.password = await bcrypt.hash(this.password, SALT_ROUNDS);
        return next();
    } catch (err) {
        return next(err);
    }
    });

    // Hash password on findOneAndUpdate when updating password.
    userSchema.pre("findOneAndUpdate", async function preFindOneAndUpdate(next) {
    try {
        const update = this.getUpdate();
        if (!update) return next();

        // Handle both $set and direct paths
        const newPassword =
        update.password ?? (update.$set && update.$set.password);

        if (newPassword) {
        const hashed = await bcrypt.hash(newPassword, SALT_ROUNDS);
        if (update.$set && "password" in update.$set) {
            update.$set.password = hashed;
        } else {
            update.password = hashed;
        }
        // Ensure password won't be returned by mistake
        this.setOptions({ new: true, fields: { password: 0 } });
        }

        return next();
    } catch (err) {
        return next(err);
    }
    });

    /** Helpful Indexes */
    userSchema.index({ createdAt: -1 });
    userSchema.index({ userType: 1, email: 1 });

    const User = mongoose.models.User || mongoose.model("User", userSchema);

    export default User;
