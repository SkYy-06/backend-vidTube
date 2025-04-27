import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

console.log("Cloudinary ENV:", process.env.CLOUDINARY_CLOUD_NAME);

// config cloudinary

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadOnCloudinary = async (filePath) => {
  console.log("Uploading file from:", filePath);
  console.log("Cloudinary config check:", {
    cloud_name: cloudinary.config().cloud_name,
    api_key: cloudinary.config().api_key,
    api_secret: cloudinary.config().api_secret, // 🔒 remove this after debug
  });

  try {
    if (!filePath) return null;

    const response = await cloudinary.uploader.upload(filePath, {
      resource_type: "auto",
    });
    console.log("File uploaded on cloudinary , File src: " + response.url)
    // once the file is uploaded, we would like to delete it from our server
    fs.unlinkSync(filePath); // remove file locally
    return response;
  } catch (error) {
    console.log("Cloudinary upload error:", error);
    return null;
  }
};
const deleteFromCloudinary = async (public_id) => {
  try {
    const result = await cloudinary.uploader.destroy(public_id);
    console.log("Deleted from cloudinary. Public id", public_id);
  } catch (error) {
    console.log("Error deleting from cloudinary", error);
    return null;
  }
};

export { uploadOnCloudinary , deleteFromCloudinary };
