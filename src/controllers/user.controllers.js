import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.models.js";
import {
  uploadOnCloudinary,
  deleteFromCloudinary,
} from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
// import { log } from "console";
// import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";


const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError(400, "Couldn't find the user");
    }
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });
    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong accessing access token and refresh token"
    );
  }
};
const registerUser = asyncHandler(async (req, res) => {
  const { fullname, email, username, password } = req.body;

  // validation
  if (
    [fullname, username, email, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required");
  }

  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });
  if (existedUser) {
    throw new ApiError(409, "User with email or username already existed");
  }

  const avatarLocalPath = req.files?.avatar?.[0]?.path;
  const coverLocalPath = req.files?.coverImage?.[0]?.path;

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is missing");
  }

  let avatar;
  try {
    avatar = await uploadOnCloudinary(avatarLocalPath);
    console.log("Uploaded avatar", avatar);
  } catch (error) {
    console.log("Error uploading avatar:", error.message);
    throw new ApiError(500, "Failed to upload Avatar");
  }

  if (!avatar?.url) {
    throw new ApiError(500, "Cloudinary did not return avatar URL");
  }

  let coverImage = null;
  if (coverLocalPath) {
    try {
      coverImage = await uploadOnCloudinary(coverLocalPath);
      console.log("Uploaded coverImage", coverImage);
    } catch (error) {
      console.log("Error uploading coverImage:", error.message);
      throw new ApiError(500, "Failed to upload coverImage");
    }
  }

  if (coverImage && !coverImage?.url) {
    throw new ApiError(500, "Cloudinary did not return coverImage URL");
  }

  try {
    const user = await User.create({
      fullname,
      avatar: avatar.url,
      coverImage: coverImage?.url || "",
      email,
      password,
      username: username.toLowerCase(),
    });
    console.log("User creation result:", user);

    const createdUser = await User.findById(user._id).select(
      "-password -refreshToken "
    );
    if (!createdUser) {
      throw new ApiError(
        500,
        "Something went wrong while registering the user"
      );
    }

    return res
      .status(201)
      .json(new ApiResponse(200, createdUser, "User registered successfully"));
  } catch (error) {
    // 🔥 DEBUG: print full error
    console.error("🔥 User creation error:", error);
    // send it back in the response for now so we can see it in Postman
    return res.status(500).json({
      statusCode: 500,
      success: false,
      message: error.message,
      stack: error.stack,
      mongoError: error,
    });

    // Delete images from Cloudinary if user creation fails
    

    if (avatar && avatar.public_id) {
      await deleteFromCloudinary(avatar.public_id);
    }

    if (coverImage && coverImage.public_id) {
      await deleteFromCloudinary(coverImage.public_id);
    }

    throw new ApiError(
      500,
      "Something went wrong while registering a user and images were deleted"
    );
  }
});
const loginUser = asyncHandler(async (req, res) => {
  // get data from body
  const { username, email, password } = req.body;

  // validation
  if (!email) {
    throw new ApiError(400, "Email is required");
  }
  const user = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }
  // validate password
  const isPasswordValid = await user.isPasswordCorrect(password);
  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid credentials");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    user._id
  );

  const loggedInUser = await User.findById(user._id).select(
    "-password =refreshToken"
  );

  if (!loggedInUser) {
    throw new ApiError(401, "Not a user");
  }

  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        { user: loggedInUser, accessToken, refreshToken },
        "User logged in successfully"
      )
    );
});

const logoutUser = asyncHandler(async (res, req) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        refreshToken: "", // can be undefines or null should be checked what version of mongodb or mongoose is used
      },
    },
    { new: true }
  );
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged out successfully"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "Refresh Token is required");
  }

  try {
    jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);
    const user = await User.findById(decodedToken?._id);

    if (!user) {
      throw new ApiError(401, "Invalid refresh token");
    }

    if (incomingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, "Invalid refresh token");
    }

    const options = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    };

    const { accessToken, refreshToken: newRefreshTOken } =
      await generateAccessAndRefreshToken(user._id);

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshTOkenrefreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken: newRefreshTOken },
          "Access token refreshed successfully"
        )
      );
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while refreshing access token"
    );
  }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  const user = await User.findById(req.user?._id);

  const isPasswordValid = await user.isPasswordCorrect(oldPassword);

  if (!isPasswordValid) {
    throw new ApiError(401, "Old password is incorrect");
  }

  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"));
});
const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "Current user details"));
});
const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullname, email } = req.body;

  if (!fullname || !email) {
    throw new ApiError(400, "Fullname and emaill are required");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        fullname,
        email: email,
      },
    },
    { new: true }
  ).select("-password -refreshToken");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated succesfully"));
});
const updateUserAvatar = asyncHandler(async (req, res) => {
  const avatarLocalPath = req.file?.path

  if(!avatarLocalPath){
    throw new ApiError(400 , "File is required")
  }
const avatar = await uploadOnCloudinary(avatarLocalPath)

if(!avatar.url){
  throw new ApiError(500 , "Something went wrong while uploading avatar")
}
const user = await User.findOneAndUpdate(
  req.user?._id,{
    $set:{
      avatar : avatar.url
    }
  },{new : true}
).select("-password -refreshToken")


return res.status(200).json(new ApiResponse(200 ,user , "Avatar updated succesfully"))

});
const updateUserCoverImage = asyncHandler(async (req, res) => {
  const coverLocalPath = req.file?.path
  if(!coverLocalPath){
    throw new ApiError(400 , "File is required")
  }
  const coverImage = await uploadOnCloudinary(coverLocalPath)
  if(!coverImage){
    throw new ApiError(500, "Something went wrong while uploading coverimage");
  }
  const user = await User.findByIdAndUpdate(
    req.user?._id,{
      $set:{
        coverImage : coverImage.url
      }
    },{new : true}
  ).select("-password -refreshToken")

 return  res.status(200).json(new ApiResponse(200 , user , "CoverImage updated successfully"))
});


const getUserChannelProfile = asyncHandler(async(req ,res) =>{
// req.params get us data from the url 
const {username } = req.params

if(!username?.trim()){
  throw new ApiError(400 , "Username is required")
}

const channelInfo = await User.aggregate(
  [
    {
      $match: {
        username: username?.toLowerCase()
      }
    } , 
    {
      $lookup:{
        from : "subscriptions",
        localField: "_id",
        foreignField: "channel" , 
        as: "subscribers"
      }
    },
    {
      $lookup:{
        from : "subscriptions", 
        localField: "_id", 
        foreignField: "subscriber", 
        as: "subscribedTo"
      }

    },
    {
      $addFields:{
        subscribersCount:{
         $size: "$subscribers"
        } , 
        channelsSubscribedToCount:{
          $size: "$subscribedTo"
        },
        isSubcribed:{
          $cond:{
            if:{$in: [req.user?._id , "$subscribers.subscriber"]},
            then: true,
            else : false
          }
        }
      }
    },
    {
      // Project only the necessary data
      $project:{
        fullname:1 , 
        username:1 , 
        avatar: 1 , 
        email:1 , 
        subscribersCount:1 , 
        channelsSubscribedToCount:1 , 
        isSubcribed: 1 , 
        coverImage:1
      }
    }
  ]
)
if(!channelInfo?.length){
  throw new ApiError(404 , "Channel not found")
}

const channel = channelInfo[0];

// 🔍 Log all the fields here
console.log("✅ Channel Profile Fetched:");
console.log("Full Name:", channel.fullname);
console.log("Username:", channel.username);
console.log("Email:", channel.email);
console.log("Avatar:", channel.avatar);
console.log("Cover Image:", channel.coverImage);
console.log("Subscribers Count:", channel.subscribersCount);
console.log("Channels Subscribed To Count:", channel.channelsSubscribedToCount);
console.log("Is Subscribed:", channel.isSubcribed);
return res.status(200).json(new ApiResponse(200) , channel[0] , "Channel profile fetched successfully")

})

const getWatchHistory = asyncHandler(async (req, res) => {

  const user = await User.aggregate([
    {
      $match:{
        _id: new mongoose.Types.ObjectId(req.user?._id)

      }
    },
    {
      $lookup:{
        from : "videos" ,
        localField:"watchHistory" , 
        foreignField: "_id",
        as : "watchHistory" ,
        pipeline:[
          {
            $lookup:{
              from : "users" ,
              localField:"owner" , 
              foreignField: "_id" , 
              as:"owner",
              pipeline:[
                {
                  $project:{
                    fullname:1 , 
                    avatar:1 , 
                    username:1
                  }
                }
              ]
            }
          },
          {
            $addFields:{
              owner:{
                $first: "$owner"
              }
            }
          }
        ]
      }
    }
  ])

 if(!user){
  throw new ApiError(404 , "User not found")
 }

 return res.status(200).json(new ApiResponse(200, user[0]?.watchHistory , "Watch history fetched successfully"))

});

export {
  registerUser,
  loginUser,
  refreshAccessToken,
  logoutUser,
  getCurrentUser,
  updateUserCoverImage,
  updateUserAvatar,
  updateAccountDetails,
  changeCurrentPassword,
  getUserChannelProfile,
  getWatchHistory
};
