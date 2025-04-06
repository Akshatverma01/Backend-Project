import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadFileOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import mongoose, { mongo } from "mongoose";

const genAccAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAcccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    // prevent mongoDB from validating the keys again.
    await user.save({ validateBeforeSave: false });
    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(500, "Internal Server Error while creating tokens.");
  }
};

const registerUser = asyncHandler(async (req, res) => {
  try {
    const { fullName, userName, email, password } = req.body;

    // Validate required fields
    if (
      [fullName, userName, email, password].some(
        (field) => field?.trim() === ""
      )
    ) {
      throw new ApiError(400, "All fields are required!");
    }

    // Check if user already exists
    const existedUser = await User.findOne({
      $or: [{ email }, { userName }],
    });

    if (existedUser) {
      throw new ApiError(409, "User or email already exists");
    }

    // Validate avatar file
    const avatarLocalPath = req.files?.avatar?.[0]?.path;
    if (!avatarLocalPath) {
      throw new ApiError(400, "Avatar is required");
    }

    // Validate cover image file
    let coverImageLocalpath;
    if (
      req.files &&
      Array.isArray(req.files.coverImage) &&
      req.files.coverImage.length > 0
    ) {
      coverImageLocalpath = req.files.coverImage[0].path;
    }

    // Upload files to Cloudinary
    const avatarUrl = await uploadFileOnCloudinary(avatarLocalPath);
    const coverImageUrl = await uploadFileOnCloudinary(coverImageLocalpath);

    if (!avatarUrl) {
      throw new ApiError(400, "Avatar upload failed");
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create the user
    const user = await User.create({
      fullName,
      avatar: avatarUrl.url,
      coverImage: coverImageUrl?.url || "",
      email,
      password: hashedPassword,
      userName: userName.toLowerCase(),
    });

    // Fetch the created user without sensitive fields
    const createdUser = await User.findById(user._id).select(
      "-password -refreshToken"
    );

    if (!createdUser) {
      throw new ApiError(
        500,
        "Something went wrong while registering the user"
      );
    }

    // Send success response
    return res
      .status(201)
      .json(new ApiResponse(201, createdUser, "User created successfully"));
  } catch (error) {
    throw new ApiError(500, "Internal Server Error!");
  }
});

const loginUser = asyncHandler(async (req, res) => {
  try {
    const { email, userName, password } = req.body;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (email && !emailRegex.test(email)) {
      throw new ApiError(400, "Invalid email format");
    }

    if (!(userName || email)) {
      throw new ApiError(400, "Username or email is required!");
    }

    const existedUser = await User.findOne({ $or: [{ userName }, { email }] });

    if (!existedUser) {
      throw new ApiError(404, "User not found");
    }

    const passwordValid = await existedUser.isPasswordCorrect(password);

    console.log(passwordValid, "password");
    // if (!passwordValid) {
    //   throw new ApiError(404, "Password is not valid.");
    // }

    // Generate access and refresh token
    const { accessToken, refreshToken } = await genAccAndRefreshToken(
      existedUser._id
    );
    const loggedInUser = await User.findById(existedUser._id).select(
      "-password -refreshToken"
    );

    console.log(loggedInUser, existedUser, "user");
    // make cookies options modifiable from server only.
    const options = {
      httpOnly: true,
      secure: true,
    };
    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json(
        new ApiResponse(
          200,
          {
            user: loggedInUser,
            accessToken,
            refreshToken,
          },
          "User Logged-In successfully"
        )
      );
  } catch (error) {
    throw new ApiError(500, error.message || "Internal Server Error!");
  }
});

const logoutUser = asyncHandler(async (req, res) => {
  // get req.user from verifyJWT

  try {
    console.log(req, "request");
    await User.findByIdAndUpdate(
      req.user._id,
      {
        $set: {
          refreshToken: null,
        },
      },
      {
        new: true,
      }
    );

    const options = {
      httpOnly: true,
      secure: true,
    };

    return res
      .status(200)
      .clearCookie("accessToken", options)
      .clearCookie("refreshToken", options)
      .json(new ApiResponse(200, {}, "User logged out successfully!"));
  } catch (error) {
    throw new ApiError(500, "Internal Server Error!" || error.message);
  }
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  try {
    const userRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if (!userRefreshToken) throw new ApiError(401, "Unauthorized User");

    const user = await User.findById(decodedToken._id);
    if (!user) {
      throw new ApiError(401, "Invalid refresh token.");
    }

    if (userRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, "Refresh token is expired");
    }
    const options = {
      httpOnly: true,
      secure: true,
    };
    const { accessToken, newRefreshToken } = await genAccAndRefreshToken(
      user?._id
    );

    return res
      .status(200)
      .cookie("accessToken", accessToken)
      .cookie("refreshToken", newRefreshToken)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken: newRefreshToken },
          "Access Token refeshed successfully."
        )
      );
  } catch (error) {
    throw new ApiError(500, error?.message || "Invalid Refresh Token");
  }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    const user = User.findById(req?.user?._id || "");
    if (!user) {
      throw new ApiError(401, "User nnot found!");
    }
    const isValidPassword = await bcrypt.compare(oldPassword, user?.password);
    if (!isValidPassword) {
      throw new ApiError(401, "Invalid Old Password");
    }

    user.password = newPassword;
    await user.save({ validateBeforeSave: false });

    return res
      .status(200)
      .json(new ApiResponse(200, {}, "Password changed successfully."));
  } catch (error) {
    throw new ApiError(500, error?.message || "Internal server error");
  }
});

const getCurrentUser = asyncHandler(async (req, res) => {
  try {
    const user = req?.user;
  } catch (error) {
    throw new ApiError(500, error?.message || "Internal server error");
  }
});

const updateAccountDetails = asyncHandler(async (req, res) => {
  try {
    const { fullName, email } = req.body;

    if (!(fullName || email)) {
      throw new ApiError(400, "All fields are required.");
    }
    const user = User.findByIdAndUpdate(
      req?.user?._id,
      {
        $set: {
          fullName: fullName,
          email: email,
        },
      },
      { new: true }
    ).select("-password");

    return res
      .status(200)
      .json(new ApiResponse(200, "Account details updated successfully."));
  } catch (error) {
    throw new ApiError(500, error?.message || "Internal server error");
  }
});

const updateUserAvatar = asyncHandler(async (req, res) => {
  try {
    console.log(req.files);
    const avatarLocalPath = req?.files?.path;

    if (!avatarLocalPath) {
      throw new ApiError(400, "No file uploaded");
    }
    const avatar = await cloudinary.uploader.upload(avatarLocalPath);

    if (!avatar?.url) {
      throw new ApiError(400, "Failed to upload avatar");
    }
    const user = User.findByIdAndUpdate(
      req?.user?._id,
      {
        $set: {
          avatar: avatar?.url,
        },
      },
      { new: true }
    ).select("-password");

    return res
      .status(200)
      .json(new ApiResponse(200, user, "Avatar updated successfully."));
  } catch (error) {
    throw new ApiError(500, error?.message || "Internal server error");
  }
});

const updateUserCoverImage = asyncHandler(async (req, res) => {
  try {
    console.log(req.files);
    const coverImageLocalpath = req?.files?.path;

    if (!coverImageLocalpath) {
      throw new ApiError(400, "No file uploaded");
    }
    const coverImage = await cloudinary.uploader.upload(coverImageLocalpath);

    if (!coverImage?.url) {
      throw new ApiError(400, "Failed to upload avatar");
    }
    const user = User.findByIdAndUpdate(
      req?.user?._id,
      {
        $set: {
          coverImage: coverImage?.url,
        },
      },
      { new: true }
    ).select("-password");

    return res
      .status(200)
      .json(new ApiResponse(200, user, "Cover Image updated successfully."));
  } catch (error) {
    throw new ApiError(500, error?.message || "Internal server error");
  }
});

const getUserChannelProfile = asyncHandler(async (req, res) => {
  try {
    const { userName } = req.params;
    if (!userName?.trim()) {
      throw new ApiError(400, "User name is required");
    }
    const channel = await User.aggregate([
      {
        $match: {
          userName: userName?.toLowerCase(),
        },
      },
      {
        $lookup: {
          from: "subscriptions",
          localField: "_id",
          foreignField: "channel",
          as: "subscribers",
        },
      },
      {
        $lookup: {
          from: "subscriptions",
          localField: "_id",
          foreignField: "subscriber",
          as: "subscribedTo",
        },
      },
      {
        $addFields: {
          subscribersCount: {
            $size: "$subscribers",
          },
          channelSubscribedToCount: {
            $size: "$subscribedTo",
          },
          isSubscribed: {
            $cond: {
              if: { $in: [req?.user?._id, "$subscribers.subscriber"] },
              then: true,
              else: false,
            },
          },
        },
      },
      {
        $project: {
          fullName: 1,
          userName: 1,
          subscribersCount: 1,
          channelSubscribedToCount: 1,
          isSubscribed: 1,
          avatar: 1,
          coverImage: 1,
          email: 1,
        },
      },
    ]);

    console.log(channel, "channel");

    if (!channel?.length) {
      throw new ApiError(404, "Channel not found");
    }

    return res
      .status(200)
      .json(new ApiResponse(200, channel[0], "Channel fetched successfully"));
  } catch (error) {
    throw new ApiError(500, error?.message || "Internal server error");
  }
});

const getWatchHistory = asyncHandler(async (req, res) => {
  try {
    const user = await User.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(user?.req?._id),
        },
      },
      {
        $lookup: {
          from: "videos",
          localField: "watchHistory",
          foreignField: "_id",
          as: "watchHistory",
          pipeline: [
            {
              $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
                pipeline: [
                  {
                    $project: {
                      fullName: 1,
                      userName: 1,
                      avatar: 1,
                    },
                  },
                ],
              },
            },
            {
              $addFields: {
                owner: {
                  $first: "$owner",
                },
              },
            },
          ],
        },
      },
    ]);

    return res
    .status(200)
    .json(new ApiResponse(200, user[0].watchHistory,"Watch history fetched successfully."));
  } catch (error) {
    throw new ApiError(500, error?.message ||"Internal Server Error");
  }
});

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
  getUserChannelProfile,
  getWatchHistory,
};
