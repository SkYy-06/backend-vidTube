import mongoose, { isValidObjectId } from "mongoose";
import { Tweet } from "../models/tweet.models.js";
import { User } from "../models/user.models.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const createTweet = asyncHandler(async (req, res) => {
  // Create tweet

  const { content } = req.body;
  const userId = req.user._id;
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (!content || content.trim() === "") {
    throw new ApiError(404, "Content is required");
  }

  if (!userId || !isValidObjectId(userId)) {
    throw new ApiError(404, "User not found");
  }

  const tweet = await Tweet.create({
    owner: userId,
    content,
  });

  if (!tweet) {
    throw new ApiError(500, "Failed to create tweet");
  }
  return res
    .status(200)
    .json(new ApiResponse(200, tweet, "Tweet created successfully"));
});

const getUserTweets = asyncHandler(async (req, res) => {
  // get user tweets
  const userId = req.params.userId;
  if (!isValidObjectId(userId) || !userId) {
    throw new ApiError(404, "User not found");
  }
  const tweet = await Tweet.aggregate([
    {
      $match: {
        owner: mongoose.Types.ObjectId(userId),
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "allTweets",
      },
    },
    {
      $unwind: "$allTweets",
    },
    {
      $project: {
        _id: 1,
        content: 1,
        "allTweets.username": 1,
        "allTweets.email": 1,
      },
    },
  ]);
  if (!tweet || tweet.length === 0) {
    throw new ApiError(404, "No tweets found for this user");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, tweet, "Tweets fetched Successfully"));
});

const updateTweet = asyncHandler(async (req, res) => {
  // update tweet

  const { updateContent } = req.body;
  const tweetId = req.params;

  if (!tweetId || !isValidObjectId(tweetId)) {
    throw new ApiError(400, "The tweetId is invalid");
  }

  if (!updateContent || !updateContent.trim() === 0) {
    throw new ApiError(400, "The tweet content is required");
  }
  const newTweet = await Tweet.findByIdAndUpdate(
    tweetId,
    {
      content: updateContent,
      owner: req.user_id,
    },
    { new: true }
  );

  if (!newTweet) {
    throw new ApiError(404, "Tweet not found");
  }
  return res
    .status(200)
    .json(new ApiResponse(200, newTweet, "Tweet updated successfully"));
});

const deleteTweet = asyncHandler(async (req, res) => {
  const tweetId = req.params;
  if (!tweetId || !isValidObjectId(tweetId)) {
    throw new ApiError(400, "The tweetId is invalid");
  }
  const deleteTweet = await Tweet.findByIdAndDelete(tweetId);

  if (!deleteTweet) {
    throw new ApiError(400, "Tweet not found");
  }
  return res
    .status(200)
    .json(new ApiResponse(200, deleteTweet, "Tweet deleted successfully"));
});
export { 
    createTweet,
    getUserTweets,
    updateTweet,
    deleteTweet };
