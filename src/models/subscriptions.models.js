import mongoose, { Schema } from "mongoose";


const subscriptionSchema = new mongoose.Schema(
  {
    subscriber: {
      type: mongoose.Schema.Types.ObjectId, // one who is Subscribing
      ref: "User",
      required: true,
    },
    channel: {
      type: mongoose.Schema.Types.ObjectId, // who they are subscribing
      
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);








export const Subscriptions = mongoose.model("Subscription", subscriptionSchema);