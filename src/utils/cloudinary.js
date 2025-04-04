import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

console.log(process.env.CLOUDINARY_CLOUD_NAME,process.env.CLOUDINARY_API_KEY,process.env.CLOUDINARY_API_SECRET,"cloud")
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadFileOnCloudinary = async (filePath) => {
  try {
    if (!filePath) {
      console.log("No file path provided");
      return null;
    }

    console.log(filePath, "File path before upload");

    const response = await cloudinary.uploader.upload(filePath, {
      resource_type: "auto",
    }).catch(err => {
      console.error("Cloudinary Upload Error:", err);
      throw err;
    });

    console.log(response, "file upload");
    fs.unlinkSync(filePath);
    return response;
    
  } catch (error) {
    // remove the locally saved temporary file as upload operation got failed
    fs.unlinkSync(filePath);
    return null;
  }
};

export {uploadFileOnCloudinary};