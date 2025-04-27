import mongoose from "mongoose";
import { Video } from "../models/video.model.js";
import { Subscription } from "../models/subscription.model.js";
import { Like } from "../models/like.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const getChannelStats = asyncHandler(async (req, res) => {
  // Get the user ID (channel) from the authenticated user
  const userId = req.user._id;

  // Fetch the total number of subscribers of the channel
  const subscribers = await Subscription.aggregate([
    {
      $match: {
        channel:  mongoose.Types.ObjectId(userId), // Match the subscription where the channel is the current user
      },
    },
    {
      $lookup: {
        from: "subscriptions", // Lookup subscriptions that are linked to the current channel's subscribers
        localField: "_id",
        foreignField: "subscribers",
        as: "totalSubs",
      },
    },
    {
      $addFields: {
        totalSubscribers: {
          $size: "$totalSubs", // Add a field to calculate the total number of subscribers
        },
      },
    },
    {
      $project: {
        totalSubscribers: 1, // Only project the totalSubscribers field
      },
    },
  ]);

  if (!subscribers || subscribers.length === 0) {
    throw new ApiError(500, "Error fetching subscriber data!");
  }

  // Fetch total video views
  const totalViews = await Video.aggregate([
    {
      $match: {
        owner:  mongoose.Types.ObjectId(userId), // Match videos belonging to the channel (owner is the current user)
      },
    },
    {
      $lookup: {
        from: "videos", // Lookup to get the views for these videos
        localField: "_id",
        foreignField: "views",
        as: "totalViews",
      },
    },
    {
      $addFields: {
        allViews: {
          $size: "$totalViews", // Count the total number of views
        },
      },
    },
    {
      $project: {
        allViews: 1, // Only project the total number of views
      },
    },
  ]);

  if (!totalViews || totalViews.length === 0) {
    throw new ApiError(500, "Error fetching video view data!");
  }

  // Fetch total likes for the videos
  const totalLikes = await Like.aggregate([
    {
      $match: {
        likedBy:  mongoose.Types.ObjectId(userId), // Match likes by the current user (channel)
      },
    },
    {
      $lookup: {
        from: "videos", // Lookup videos linked to the user's likes
        localField: "_id",
        foreignField: "likes",
        as: "allLikes",
      },
    },
    {
      $addFields: {
        totalLikes: {
          $size: "$allLikes", // Count the total likes
        },
      },
    },
  ]);

  if (!totalLikes || totalLikes.length === 0) {
    throw new ApiError(500, "Error fetching like data!");
  }

  // Return the response with all aggregated statistics
  return res.status(200).json(
    new ApiResponse(
      200,
      {
        totalSubscribers: subscribers[0].totalSubscribers, // Total subscribers count
        totalViews: totalViews[0].allViews, // Total video views
        totalLikes: totalLikes[0].totalLikes, // Total likes count
      },
      "Channel statistics fetched successfully!" // Success message
    )
  );
});

const getChannelVideos = asyncHandler(async (req, res) => {
  // Get the user ID (channel) from the authenticated user
  const userId = req.user._id;

  // Use aggregation to fetch the videos and count them in one query
  const result = await Video.aggregate([
    {
      $match: {
        owner:  mongoose.Types.ObjectId(userId), // Match the videos where the owner is the current user (channel)
      },
    },
    {
      $facet: {
        // Fetch all videos with necessary fields (title, thumbnail, etc.)
        videos: [
          {
            $project: {
              title: 1, // Include title in the output
              thumbnail: 1, // Include thumbnail in the output
              videoFile: 1, // Include video file link in the output
              isPublished: 1, // Include publication status
            },
          },
        ],
        // Count the total number of videos uploaded by the user (channel)
        totalVideos: [
          {
            $count: "count", // Count the total number of videos
          },
        ],
      },
    },
  ]);

  // Check if the aggregation result is empty or failed
  if (!result || result.length === 0) {
    throw new ApiError(500, "Error fetching videos!");
  }

  // Extract the videos and the total video count from the aggregation result
  const videos = result[0].videos; // Array of video data
  const totalVideos =
    result[0].totalVideos.length > 0 ? result[0].totalVideos[0].count : 0; // Get the total count of videos

  // Return the response with the videos and the total video count
  return res.status(200).json(
    new ApiResponse(
      200,
      {
        totalVideos, // Total count of videos uploaded by the user
        videos, // Array of video details
      },
      "Channel videos fetched successfully!" // Success message
    )
  );
});
