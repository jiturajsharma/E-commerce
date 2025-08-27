    import { asyncHandler } from "../utils/asyncHandler.js";
    import { ApiError } from "../utils/ApiError.js";
    import ApiResponse from "../utils/ApiResponse.js";
    import { uploadOnCloudinary } from "../utils/cloudinary.js";
    import User from "../models/user.model.js";
    import bcrypt from "bcryptjs";
    import nodemailer from "nodemailer";
    import PaymentMethod from "../models/userPaymentMethod.model.js";
    import Stripe from "stripe";
    import dotenv from "dotenv";

    dotenv.config();

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    /**
     * Helper: create nodemailer transporter (uses basic auth - ensure env is set)
     */
    function createTransporter() {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        throw new Error("EMAIL_USER and EMAIL_PASS must be set in env to send emails");
    }
    return nodemailer.createTransport({
        service: "gmail",
        auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
        },
    });
    }

    /**
     * @desc Register user
     * @route POST /api/v1/users/register
     * @access Public
     */
    export const registerUser = asyncHandler(async (req, res) => {
    const { fullName, email, password } = req.body;

    if (![fullName, email, password].every(Boolean)) {
        return res.status(400).json(new ApiResponse(400, "Full name, email and password are required"));
    }

    // Normalize
    const normalizedFullName = String(fullName).trim();
    const normalizedEmail = String(email).trim().toLowerCase();

    // check existence
    const existedUser = await User.findOne({ $or: [{ fullName: normalizedFullName }, { email: normalizedEmail }] });
    if (existedUser) {
        return res.status(409).json(new ApiResponse(409, "User already exists"));
    }

    // Create stripe customer
    let customer;
    try {
        customer = await stripe.customers.create({ email: normalizedEmail, name: normalizedFullName });
    } catch (err) {
        console.error("[Stripe] create customer error:", err?.message || err);
        return res.status(500).json(new ApiResponse(500, "Error creating payment customer"));
    }

    // Create user (password hashing is handled by model pre-save)
    const user = await User.create({
        fullName: normalizedFullName,
        email: normalizedEmail,
        password,
    });

    const createdUser = await User.findById(user._id).select("-password");
    if (!createdUser) {
        return res.status(500).json(new ApiResponse(500, "Error creating user"));
    }

    // Create PaymentMethod record (store stripe customer id)
    try {
        await PaymentMethod.create({
        stripeCustomerId: customer.id,
        paymentMethodId: null,
        user: createdUser._id,
        });
    } catch (err) {
        // Log but don't fail user creation
        console.warn("[PaymentMethod] creation failed:", err?.message || err);
    }

    return res.status(201).json(new ApiResponse(201, "User registered successfully", createdUser));
    });

    /**
     * @desc Login user
     * @route POST /api/v1/users/login
     * @access Public
     */
    export const loginUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json(new ApiResponse(400, "Email and password are required"));
    }

    const user = await User.findOne({ email: String(email).trim().toLowerCase() }).select("+password");
    if (!user) {
        return res.status(404).json(new ApiResponse(404, "User not found"));
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
        return res.status(401).json(new ApiResponse(401, "Invalid credentials"));
    }

    const JwtToken = user.generateJwtToken();
    const loggedInUser = await User.findById(user._id).select("-password");

    const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production", // only send cookie over https in prod
        sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
        maxAge: 24 * 60 * 60 * 1000, // 1 day
    };

    return res
        .status(200)
        .cookie("JwtToken", JwtToken, cookieOptions)
        .json(new ApiResponse(200, "User logged in successfully", { user: loggedInUser, JwtToken }));
    });

    /**
     * @desc Send forgot password email
     * @route POST /api/v1/users/forgot-password
     * @access Public
     */
    export const forgotPassword = asyncHandler(async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json(new ApiResponse(400, "Email is required"));

    const user = await User.findOne({ email: String(email).trim().toLowerCase() });
    if (!user) return res.status(404).json(new ApiResponse(404, "No account with that email"));

    // generate token and save on user
    const resetToken = user.generateResetToken();
    await user.save({ validateBeforeSave: false });

    // build reset url (use FRONTEND_URL in env)
    const frontendBase = process.env.FRONTEND_URL || "http://localhost:5173";
    const resetUrl = `${frontendBase}/reset-password/${user._id}/${resetToken}`;

    // send email
    try {
        const transporter = createTransporter();
        const mailOptions = {
        from: process.env.EMAIL_USER,
        to: user.email,
        subject: "Password Reset Request",
        html: `
            <p>Hi ${user.fullName},</p>
            <p>You requested a password reset. Click below to reset your password (valid for 10 minutes):</p>
            <p><a href="${resetUrl}">Reset password</a></p>
            <p>If you didn't request this, please ignore this email.</p>
        `,
        };

        await transporter.sendMail(mailOptions);
        return res.status(200).json(new ApiResponse(200, "Password reset email sent"));
    } catch (err) {
        console.error("[Mail] send error:", err?.message || err);
        // cleanup token on user
        user.resetToken = undefined;
        user.resetTokenExpire = undefined;
        await user.save({ validateBeforeSave: false });

        return res.status(500).json(new ApiResponse(500, "Failed to send reset email"));
    }
    });

    /**
     * @desc Reset password (consume token)
     * @route POST /api/v1/users/reset-password/:userId/:token
     * @access Public
     */
    export const resetPassword = asyncHandler(async (req, res) => {
    const { userId, token } = req.params;
    const { password } = req.body;

    if (!password) return res.status(400).json(new ApiResponse(400, "Password is required"));

    // verify token
    try {
        const payload = jwt.verify(token, process.env.RESET_TOKEN_SECRET);
        if (!payload || payload._id !== userId) {
        return res.status(401).json(new ApiResponse(401, "Invalid or expired reset token"));
        }
    } catch (err) {
        return res.status(401).json(new ApiResponse(401, "Invalid or expired reset token"));
    }

    // find user and update password
    const user = await User.findById(userId).select("+password resetToken resetTokenExpire");
    if (!user) return res.status(404).json(new ApiResponse(404, "User not found"));

    // ensure token matches stored token and not expired
    if (user.resetToken !== token || !user.resetTokenExpire || user.resetTokenExpire < Date.now()) {
        return res.status(401).json(new ApiResponse(401, "Invalid or expired reset token"));
    }

    user.password = password;
    user.resetToken = undefined;
    user.resetTokenExpire = undefined;
    await user.save();

    return res.status(200).json(new ApiResponse(200, "Password reset successfully"));
    });

    export default {
    registerUser,
    loginUser,
    forgotPassword,
    resetPassword,
    };
