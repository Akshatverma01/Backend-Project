import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadFileOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import bcrypt from "bcrypt";

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

    if (!(userName || email)) {throw new ApiError(400, "Username or email is required!");    }

    const existedUser = await User.findOne({ $or: [{ userName }, { email }], });

    if (!existedUser) {
      throw new ApiError(404, "User not found");
    }

    const passwordValid = await existedUser.isPasswordCorrect(password);

    console.log(passwordValid, "password");
    // if (!passwordValid) {
    //   throw new ApiError(404, "Password is not valid.");
    // }

    // Generate access and refresh token
    const { accessToken, refreshToken } = await genAccAndRefreshToken(existedUser._id);
    const loggedInUser = await User.findById(existedUser._id).select(
      "-password -refreshToken"
    );
    
    console.log(loggedInUser,existedUser,"user")
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
    console.log(req,"request")
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
export { registerUser, loginUser, logoutUser };
