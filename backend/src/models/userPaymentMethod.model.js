    import mongoose from "mongoose";

    const paymentMethodSchema = new mongoose.Schema(
    {
        stripeCustomerId: { type: String, required: true },
        paymentMethodId: { type: String, required: true },
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    },
    {
        timestamps: true,
    }
    );

    const PaymentMethod = mongoose.model("PaymentMethod", paymentMethodSchema);

    export default PaymentMethod;
