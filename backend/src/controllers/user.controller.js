    // controllers/user.controller.js
    import jwt from "jsonwebtoken";
    import { asyncHandler } from "../utils/asyncHandler.js";
    import { ApiError } from "../utils/ApiError.js";
    import ApiResponse from "../utils/ApiResponse.js";
    import { uploadOnCloudinary } from "../utils/cloudinary.js";
    import User from "../models/user.model..js";
    import bcrypt from "bcryptjs";
    import nodemailer from "nodemailer";
    import PaymentMethod from "../models/userPaymentMethod.model.js";
    import Stripe from "stripe";
    import mongoose from "mongoose";
    import dotenv from "dotenv";

    dotenv.config();

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    /**
     * Helper: nodemailer transporter
     */
    function createTransporter() {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        throw new Error("EMAIL_USER and EMAIL_PASS are required in env to send emails");
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
     * Register user
     */
    const registerUser = asyncHandler(async (req, res) => {
    const { fullName, email, password } = req.body;

    if (![fullName, email, password].every(Boolean)) {
        return res.status(400).json(new ApiResponse(400, "Full name, email and password are required"));
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const normalizedFullName = String(fullName).trim();

    const existedUser = await User.findOne({
        $or: [{ fullName: normalizedFullName }, { email: normalizedEmail }],
    });

    if (existedUser) {
        return res.status(409).json(new ApiResponse(409, "User already exists"));
    }

    // create stripe customer
    let customer;
    try {
        customer = await stripe.customers.create({ email: normalizedEmail, name: normalizedFullName });
    } catch (err) {
        console.error("[Stripe] create customer:", err?.message || err);
        return res.status(500).json(new ApiResponse(500, "Payment provider error"));
    }

    const user = await User.create({
        fullName: normalizedFullName,
        email: normalizedEmail,
        password,
    });

    const createdUser = await User.findById(user._id).select("-password");

    if (!createdUser) {
        return res.status(500).json(new ApiResponse(500, "Error creating user"));
    }

    // store stripe customer id
    try {
        await PaymentMethod.create({
        stripeCustomerId: customer.id,
        paymentMethodId: null,
        user: createdUser._id,
        });
    } catch (err) {
        console.warn("[PaymentMethod] create failed:", err?.message || err);
    }

    return res.status(201).json(new ApiResponse(201, "User registered successfully", createdUser));
    });

    /**
     * Login user
     */
    const loginUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json(new ApiResponse(400, "Email and password are required"));
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail }).select("+password");
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
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
        maxAge: 24 * 60 * 60 * 1000, // 1 day
    };

    return res
        .status(200)
        .cookie("JwtToken", JwtToken, cookieOptions)
        .json(new ApiResponse(200, "User logged in successfully", { user: loggedInUser, JwtToken }));
    });

    /**
     * Logout user
     */
    const logoutUser = asyncHandler(async (req, res) => {
    res.clearCookie("JwtToken", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
    });
    return res.status(200).json(new ApiResponse(200, "Logged out successfully"));
    });

    /**
     * Send forgot password email
     */
    const forgetPasswordSendEmail = asyncHandler(async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json(new ApiResponse(400, "Email is required"));

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) return res.status(404).json(new ApiResponse(404, "No account with that email"));

    const resetToken = user.generateResetToken();
    await user.save({ validateBeforeSave: false });

    const frontendBase = process.env.FRONTEND_URL || "http://localhost:5173";
    const resetUrl = `${frontendBase}/reset-password/${user._id}/${resetToken}`;

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
        // cleanup token
        user.resetToken = undefined;
        user.resetTokenExpire = undefined;
        await user.save({ validateBeforeSave: false });
        return res.status(500).json(new ApiResponse(500, "Failed to send reset email"));
    }
    });

    /**
     * Reset password handler (consumes token)
     * route -> POST /reset-password/:id/:token
     */
    const resetPassword = asyncHandler(async (req, res) => {
    const { id: userId, token } = req.params;
    const { password } = req.body;

    if (!password) return res.status(400).json(new ApiResponse(400, "Password is required"));

    // verify token using RESET_TOKEN_SECRET
    try {
        const payload = jwt.verify(token, process.env.RESET_TOKEN_SECRET);
        if (!payload || payload._id !== userId) {
        return res.status(401).json(new ApiResponse(401, "Invalid or expired reset token"));
        }
    } catch (err) {
        return res.status(401).json(new ApiResponse(401, "Invalid or expired reset token"));
    }

    const user = await User.findById(userId).select("+password resetToken resetTokenExpire");
    if (!user) return res.status(404).json(new ApiResponse(404, "User not found"));

    if (user.resetToken !== token || !user.resetTokenExpire || user.resetTokenExpire < Date.now()) {
        return res.status(401).json(new ApiResponse(401, "Invalid or expired reset token"));
    }

    user.password = password;
    user.resetToken = undefined;
    user.resetTokenExpire = undefined;
    await user.save();

    return res.status(200).json(new ApiResponse(200, "Password reset successfully"));
    });

    /**
     * Update user profile (with optional profile picture upload)
     */
    const updateUserProfile = asyncHandler(async (req, res) => {
    const { fullName, email, location, phone, address, city, gender, description } = req.body;
    const userId = req.user?._id;

    if (!userId) return res.status(401).json(new ApiResponse(401, "Unauthorized"));

    const updates = {};
    if (fullName) updates.fullName = String(fullName).trim();
    if (email) updates.email = String(email).trim().toLowerCase();
    if (location) updates.location = location;
    if (phone) updates.phone = phone;
    if (address) updates.address = address;
    if (city) updates.city = city;
    if (gender) updates.gender = gender;
    if (description) updates.description = description;

    // handle profile picture if uploaded (multer provides req.file)
    if (req.file) {
        const uploaded = await uploadOnCloudinary(req.file.path, { folder: "profile_pictures" });
        if (uploaded && uploaded.secure_url) updates.profilePicture = uploaded.secure_url;
    }

    const updatedUser = await User.findByIdAndUpdate(userId, updates, { new: true }).select("-password");
    return res.status(200).json(new ApiResponse(200, "Profile updated", updatedUser));
    });

    /**
     * Change current password (user must provide currentPassword)
     */
    const changeCurrentPassword = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    const { currentPassword, newPassword } = req.body;

    if (!userId) return res.status(401).json(new ApiResponse(401, "Unauthorized"));
    if (!currentPassword || !newPassword) return res.status(400).json(new ApiResponse(400, "Both current and new password are required"));

    const user = await User.findById(userId).select("+password");
    if (!user) return res.status(404).json(new ApiResponse(404, "User not found"));

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.status(401).json(new ApiResponse(401, "Current password is incorrect"));

    user.password = newPassword;
    await user.save();

    return res.status(200).json(new ApiResponse(200, "Password changed successfully"));
    });

    /**
     * Admin: get all users
     */
    const getAllUsers = asyncHandler(async (req, res) => {
    const users = await User.find().select("-password").sort({ createdAt: -1 });
    return res.status(200).json(new ApiResponse(200, "Users fetched", users));
    });

    /**
     * Admin: get user by id
     */
    const getUserById = asyncHandler(async (req, res) => {
    const { userid } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userid)) return res.status(400).json(new ApiResponse(400, "Invalid user id"));

    const user = await User.findById(userid).select("-password");
    if (!user) return res.status(404).json(new ApiResponse(404, "User not found"));
    return res.status(200).json(new ApiResponse(200, "User fetched", user));
    });

    /**
     * Admin: update user by id
     */
    const updateUserById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json(new ApiResponse(400, "Invalid id"));

    const updates = {};
    const allowedFields = ["fullName", "email", "userType", "location", "phone", "address", "city", "gender", "description", "paymentVerified"];
    for (const key of allowedFields) {
        if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    if (req.file) {
        const uploaded = await uploadOnCloudinary(req.file.path, { folder: "profile_pictures" });
        if (uploaded && uploaded.secure_url) updates.profilePicture = uploaded.secure_url;
    }

    const updated = await User.findByIdAndUpdate(id, updates, { new: true }).select("-password");
    if (!updated) return res.status(404).json(new ApiResponse(404, "User not found"));
    return res.status(200).json(new ApiResponse(200, "User updated", updated));
    });

    /**
     * Admin: delete user by id
     */
    const deleteUserById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json(new ApiResponse(400, "Invalid id"));

    const removed = await User.findByIdAndDelete(id);
    if (!removed) return res.status(404).json(new ApiResponse(404, "User not found"));
    return res.status(200).json(new ApiResponse(200, "User deleted"));
    });

    /**
     * Get top sellers (example: sellers with most auctions or paymentVerified)
     * This is a simple example; tweak aggregation to your data model/requirements.
     */
    const getTopSellers = asyncHandler(async (req, res) => {
    const sellers = await User.aggregate([
        { $match: { userType: "seller" } },
        { $project: { fullName: 1, email: 1, profilePicture: 1, createdAt: 1 } },
        { $limit: 10 },
    ]);
    return res.status(200).json(new ApiResponse(200, "Top sellers", sellers));
    });

    /**
     * Get top cities (example: count users grouped by city)
     */
    const getTopCities = asyncHandler(async (req, res) => {
    const cities = await User.aggregate([
        { $match: { city: { $exists: true, $ne: "" } } },
        { $group: { _id: "$city", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
    ]);
    return res.status(200).json(new ApiResponse(200, "Top cities", cities));
    });

    export {
    changeCurrentPassword,
    resetPassword,
    forgetPasswordSendEmail,
    loginUser,
    logoutUser,
    registerUser,
    updateUserProfile,
    getCurrentUser,
    getAllUsers,
    getUserById,
    updateUserById,
    deleteUserById,
    getTopSellers,
    getTopCities,
    };

    // Helper export for routes that call getCurrentUser
    async function getCurrentUser(req, res) {
    const user = req.user ? await User.findById(req.user._id).select("-password") : null;
    return res.status(200).json(new ApiResponse(200, "Current user", user));
    }
