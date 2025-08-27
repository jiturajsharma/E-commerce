    // models/userPaymentMethod.model.js
    import mongoose from "mongoose";

    const paymentMethodSchema = new mongoose.Schema(
    {
        stripeCustomerId: {
        type: String,
        required: true,
        trim: true,
        },
        paymentMethodId: {
        type: String,
        trim: true,
        default: null, // optional until user adds a card/method
        },
        user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
    );

    // Hot-reload safe model export (avoids OverwriteModelError)
    const PaymentMethod = mongoose.models.PaymentMethod || mongoose.model("PaymentMethod", paymentMethodSchema);

    export default PaymentMethod;
