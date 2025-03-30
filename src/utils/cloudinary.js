import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadFileOnCloudinary = async (filePath) => {
  try {
    if (!filePath) return null;
    const response = await cloudinary.uploader.upload(filePath, {
      resource_type: "auto",
    });
    console.log(response.url, "file upload");
    return response;
  } catch (error) {
    // remove the locally saved temporary file as upload operation got failed
    fs.unlinkSync(filePath);
    return null;
  }
};

export {uploadFileOnCloudinary};