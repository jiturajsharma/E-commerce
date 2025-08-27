    import mongoose, { Schema } from "mongoose";

    const cartSchema = new Schema(
    {
        user: { 
        type: Schema.Types.ObjectId, 
        ref: "User", 
        required: true 
        },
        products: [
        {
            product: { 
            type: Schema.Types.ObjectId, 
            ref: "Auction", 
            required: true 
            },
            quantity: { 
            type: Number, 
            default: 1, 
            min: 1 
            },
            addedAt: { 
            type: Date, 
            default: Date.now 
            }
        }
        ],
    },
    { 
        timestamps: true 
    }
    );

    const Cart = mongoose.model("Cart", cartSchema);
    export default Cart;
