import mongoose from "mongoose";
import {Comment} from "../models/comment.models.js"
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const getVideoComments = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    if (!videoId) {
        throw new ApiError(404, "Video not found");
    }

    const pipeline = [
        {
            $match: {
                videoId:  mongoose.Types.ObjectId(videoId)
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "userDetails",
                pipeline: [
                    {
                        $project: {
                            username: 1,
                            avatar: 1
                        }
                    }
                ]
            }
        },
        {
            $unwind: {
                path: "$userDetails",
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $project: {
                content: 1,
                createdAt: 1,
                "userDetails.username": 1,
                "userDetails.avatar": 1
            }
        }
    ];

    const options = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10)
    };

    const result = await Comment.aggregatePaginate(Comment.aggregate(pipeline), options);

    if (!result) {
        throw new ApiError(500, "Something went wrong while fetching comments");
    }

    return res.status(200).json(new ApiResponse(200, result, "The comments fetched successfully"));
});

const addComment = asyncHandler(async (req, res) => {
  const { comment } = req.body;
  const { videoId } = req.params;

  if (!comment || comment.trim() === "") {
    throw new ApiError(400, "Please enter a comment!");
  }

  const newComment = await Comment.create({
    content: comment,
    videoId: videoId,
    owner: req.user._id,
  });

  if (!newComment) {
    throw new ApiError(500, "Something went wrong while creating comment");
  }

  return res
    .status(201)
    .json(new ApiResponse(201, newComment, "New comment added successfully"));
});

const updateComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  const { updatedComment } = req.body;

  if (!updatedComment || updatedComment.trim() === "") {
    throw new ApiError(400, "Please enter a valid updated comment!");
  }

  if (!commentId) {
    throw new ApiError(400, "Comment ID is required");
  }

  const comment = await Comment.findById(commentId);

  if (!comment) {
    throw new ApiError(404, "Comment not found!");
  }

  comment.content = updatedComment;
  await comment.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, comment, "Comment updated successfully!"));
});

const deleteComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;

  if (!commentId) {
    throw new ApiError(400, "Comment ID is required");
  }

  const deletedComment = await Comment.findByIdAndDelete(commentId);

  if (!deletedComment) {
    throw new ApiError(404, "Comment not found!");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, deletedComment, "Comment deleted successfully!")
    );
});

export{
    addComment,
    updateComment,
    getVideoComments,
    deleteComment
}