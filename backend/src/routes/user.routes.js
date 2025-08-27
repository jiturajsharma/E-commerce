    // src/routes/user.routes.js
    import { Router } from "express";
    import mongoose from "mongoose";

    import {
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
    } from "../controllers/user.controller.js";

    import { verifyAdmin, verifyUser } from "../middlewares/auth.middleware.js";
    import { upload } from "../middlewares/multer.middleware.js";

    const router = Router();

    /**
     * Validate Mongo ObjectId helper middleware
     */
    const validateObjectId = (paramName) => (req, _res, next) => {
    const value = req.params[paramName];
    if (!value || !mongoose.Types.ObjectId.isValid(value)) {
        const err = new Error(`Invalid id in parameter "${paramName}"`);
        err.status = 400;
        return next(err);
    }
    next();
    };

    /**
     * Use router.param to attach validation for :id and :userid
     */
    router.param("id", validateObjectId("id"));
    router.param("userid", validateObjectId("userid"));

    /**
     * Public auth routes
     */
    router.post("/register", registerUser);
    router.post("/login", loginUser);
    router.post("/forgot-password", forgetPasswordSendEmail);
    router.post("/reset-password/:id/:token", resetPassword); // :id validated by router.param

    /**
     * Protected user routes (authenticated)
     */
    router.post("/logout", verifyUser, logoutUser);
    router.get("/current-user", verifyUser, getCurrentUser);
    router.put("/change-password", verifyUser, changeCurrentPassword);
    router.put(
    "/update-user-profile",
    verifyUser,
    upload.single("profilePicture"),
    updateUserProfile
    );

    /**
     * Admin-only routes (verifyUser -> verifyAdmin)
     */
    router.get("/top-cities", verifyUser, verifyAdmin, getTopCities);
    router.get("/top-sellers", verifyUser, verifyAdmin, getTopSellers);
    router.get("/", verifyUser, verifyAdmin, getAllUsers);

    /**
     * Routes operating on user id
     */
    router.get("/:userid", verifyUser, verifyAdmin, getUserById);
    router.put(
    "/update-user/:id",
    verifyUser,
    verifyAdmin,
    upload.single("profilePicture"),
    updateUserById
    );
    router.delete("/:id", verifyUser, verifyAdmin, deleteUserById);

    export default router;
