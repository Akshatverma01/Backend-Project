import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import {User} from "../models/user.model.js"
import { uploadFileOnCloudinary } from "../utils/cloudinary.js";
import {ApiResponse} from "../utils/ApiResponse.js"

const registerUser = asyncHandler(async (req, res) => {
  const { fullName, userName, email, password } = req.body;
  if (
    [fullName, userName, email, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required!");
  }

  const existedUser =  User.findOne({
    $or: [{ email }, { userName }],
  })

  if(existedUser){
    throw new ApiError(409, "User or email already exists");
  }

  const avatarLocalPath = req.files?.avatar[0]?.path;
  const coverImageLocalpath = req.files?.coverImage[0]?.path;

  if(!avatarLocalPath){
    throw new ApiError(400, "Avatar is required");
  }

  const avatarUrl = await uploadFileOnCloudinary(avatarLocalPath);
  const coverImageUrl = await uploadFileOnCloudinary(coverImageLocalpath);

  if(!avatarUrl){
    throw new ApiError(400, "Avatar upload failed");
  }

  const user = await User.create({
    fullName,
    avatar: avatarUrl.url,
    coverImage : coverImageUrl?.url ||"",
    email,
    password,
    userName: userName.toLowerCase()
  })
  
  const createdUser = await User.findById(user._id).select("-password -refreshToken"); 
  
  if(!createdUser){throw new ApiError(500,"Something went wrong while registering the user")}

  return res.status(201).json(new ApiResponse(201,createdUser, "User created successfully"))
});

export { registerUser };
