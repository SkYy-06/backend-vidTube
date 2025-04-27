import mongoose, { isObjectIdOrHexString, isValidObjectId } from "mongoose";
import { User } from "../models/user.model.js";
import { Subscriptions } from "../models/subscription.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const toggleSubscription = asyncHandler(async (req, res) => {
  const { channelId } = req.params;
  const subscriberId = req.user._id;

  if (!channelId || !isValidObjectId(channelId)) {
    throw new ApiError(400, "Invalid channelId");
  }

  if (subscriberId.toString() === channelId.toString()) {
    throw new ApiError(400, "You cannot subscribe to yourself");
  }

  const existingSubscription = await Subscriptions.findOne({
    subscriber: subscriberId,
    channel: channelId,
  });

  if (existingSubscription) {
    // Already subscribed, so Unsubscribe
    await Subscriptions.deleteOne({ _id: existingSubscription._id });
    return res
      .status(200)
      .json(new ApiResponse(200, null, "Unsubscribed successfully"));
  } else {
    // Not subscribed yet, so Subscribe
    const newSubscription = await Subscriptions.create({
      subscriber: subscriberId,
      channel: channelId,
    });

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          newSubscription,
          "Subscription updated successfully"
        )
      );
  }
});

const getUserChannelSubscribers = asyncHandler(async (req, res) => {
  const { channelId } = req.params;

  if (!channelId || !isValidObjectId(channelId)) {
    throw new ApiError(400, "Invalid channelId");
  }
  const subscribers = await Subscriptions.find({ channel: channelId });

  if (!subscribers) {
    throw new ApiError(404, "Subscriber not found");
  }
  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        subscribers.subscriber,
        "This the number of subscriber of the channel"
      )
    );
});

const getSubscribedChannels = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  if (!isValidObjectId(userId)) {
    throw new ApiError(404, "Subscriber not found");
  }

  const subscribedChannels = await Subscriptions.aggregate([
    {
      $match: {
        subscriberId: mongoose.Types.ObjectId(req.user._id),
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "channel",
        foreignField: "_id",
        as: "subscribedChannels",
      },
    },
    {
      $unwind: "$subscribedChannels",
    },
    {
      $project: {
        subscribedChannels: {
          _id: 0,
          username: "$channelDetails.username",
          avatar: "$channelDetails.avatar",
          subscriberCount: "$channelDetails.subscriberCount",
        },
      },
    },
  ]);

  if (!subscribedChannels || subscribedChannels.length === 0) {
    throw new ApiError(400, " Channel not found");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        subscribedChannels[0].subscribedChannels,
        " Subscribed channels fetched"
      )
    );
});
export { toggleSubscription, getUserChannelSubscribers, getSubscribedChannels };
