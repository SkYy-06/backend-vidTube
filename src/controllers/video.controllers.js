import mongoose,   { isValidObjectId } from "mongoose";

import { Video } from "../models/video.models.js";
import { User } from "../models/user.models.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  deleteFromCloudinary,
  uploadOnCloudinary,
} from "../utils/cloudinary.js";
const { ObjectId } = mongoose.Types;
const getAllVideos = asyncHandler(async (req, res) => {
  // Todo : get all videos bases on query , sort , pagination
  const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query;
  

  if (!userId || !isValidObjectId(userId)) {
    throw new ApiError(404, "User not found");
  }
  if (!query) {
    throw new ApiError(404, "Query not found");
  }
  const owner = await User.findById(userId);

  if (!owner) {
    throw new ApiError(404, "User not found");
  }

  const videos = await Video.aggregate([
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
        as: "ownerDetails",
        pipeline: {
          $project: {
            username: 1,
            avatar: 1,
          },
        },
      },
    },
    {
      $unwind: "$ownerDetails",
    },
    {
      $sort: {
        [sortBy]: sortType === "desc" ? -1 : 1,
      },
    },
    {
      $skip: (page - 1) * limit,
    },
    {
      $limit: parserInt (limit, 10),
    },
    {
      $project: {
        title: 1,
        description: 1,
        videoFile: 1,
        thumbnail: 1,
        ownerDetails: 1,
        createdAt: 1,
        updatedAt: 1,
      },
    },
  ]);

  if (videos.length === 0) {
    throw new ApiError(404, "No videos found for the given query.");
  }
  return res
    .status(200)
    .json(new ApiResponse(200, videos, "Videos retrieved successfully"));
});

const publishAVideo = asyncHandler(async (req, res) => {
  // Todo : get video , upload to cloudinary , create video

  const { title, description } = req.body;
  const videoFilePath = req.files?.videoFile[0].path;
  const thumbnailFilePath = req.files?.thumbnail[0].path;

  if (!videoFilePath || !thumbnailFilePath) {
    throw new ApiError(400, "Video file and thumbnail file are required");
  }
  if (!title || !description) {
    throw new ApiError(400, "Title and description are required");
  }
  const videoFile = await uploadOnCloudinary(videoFilePath);
  const thumbnailFile = await uploadOnCloudinary(thumbnailFilePath);

  if (!videoFile || !thumbnailFile) {
    throw new ApiError(
      500,
      "Failed to upload video or thumbnail to cloudinary"
    );
  }

  const newVideo = await Video.create({
    title,
    description,
    thumbnail: [thumbnailFile.secure_url, thumbnailFile.public_id],
    videoFile: [videoFile.secure_url, videoFile.public_id],
    owner: req.user._id,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, newVideo, "Video published succesfully"));
});

const getVideoById = asyncHandler(async (req, res) => {
  //Todo : get video by id
  const { videoId } = req.params;
  if (!videoId || !isValidObjectId(videoId)) {
    throw new ApiError(404, "Video not found");
  }

  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(404, "Video not found");
  }
  return res
    .status(200)
    .json(new ApiResponse(200, video, "Video retrieved successfully"));
});

const updateVideo = asyncHandler(async (req, res) => {
  // Todo : update video details like title , description , thumbnail

  const { videoId } = req.params;
  if (!videoId || !isValidObjectId(videoId)) {
    throw new ApiError(404, "Video not found");
  }
  // to delete the old thumbnail from cloudinary

  const video = await Video.findById(videoId);
  await deleteFromCloudinary(video.thumbnail[1]);
  const { title, description } = req.body;
  const thumbnailFilePath = req.file.thumbnail[0].path;
  if (!title || !description) {
    throw new ApiError(400, "Title and description are required");
  }
  if (!thumbnailFilePath) {
    throw new ApiError(400, "Thumbnail is required");
  }

  const thumbnail = await uploadOnCloudinary(thumbnailFilePath);

  if (!thumbnail) {
    throw new ApiError(500, "Failed to upload thumbnail to cloudinary");
  }

  const updateVideo = await Video.findByIdAndUpdate(
    videoId,
    {
      title,
      description,
      thumbnail: [thumbnail.secure_url, thumbnail.public_id],
      owner: req.user._id,
    },
    { new: true }
  );

  if (!updateVideo) {
    throw new ApiError(404, "Video not found");
  }
  return res
    .status(200)
    .json(new ApiResponse(200, updateVideo, "Video Updated Successfully"));
});

const deleteVideo = asyncHandler(async (req, res) => {
  const videoId = req.params;
  if (!videoId || !isValidObjectId(videoId)) {
    throw new ApiError(404, "Video not found");
  }
  const video = await Video.findById(videoId);
  if (!videoId) {
    throw new ApiError(404, "Video not found");
  }
  const thumbnail = video.thumbnail[1];
  const videoField = video.videoFile[1];
  await deleteFromCloudinary(thumbnail);
  await deleteFromCloudinary(videoField);
  await Video.findByIdAndDelete(videoId);

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Video deleted successfully"));
});

const togglePublishStatus = asyncHandler(async (req, res) => {
  const videoId = req.params;
  if (!videoId || !isValidObjectId(videoId)) {
    throw new ApiError(404, "Video not found");
  }
  const video = await Video.findById(videoId);
  if (!videoId) {
    throw new ApiError(404, "Video not found");
  }
  video.isPublished = !video.isPublished;
  await video.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(
      new ApiResponse(200, video, "Video publish status toggled successfully")
    );
});

export {
  getAllVideos,
  publishAVideo,
  getVideoById,
  updateVideo,
  deleteVideo,
  togglePublishStatus,
};