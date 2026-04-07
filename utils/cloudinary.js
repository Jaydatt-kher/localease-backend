import { v2 as cloudinary } from 'cloudinary';
import fs from "fs";
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});
export const uploadOnCloudinary = async localFilePath => {
  if (!localFilePath) {
    throw new Error("filepath is required!");
  }
  try {
    const uploadResults = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto"
    });
    fs.unlinkSync(localFilePath);
    return uploadResults.secure_url;
  } catch (error) {
    console.error("Error in uploadOnCloudinary:", error);
    if (fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
    }
    return null;
  }
};
export const deleteOnCloudinary = async imageUrls => {
  try {
    if (!imageUrls) return null;
    const publicId = imageUrls.split('/').pop().split('.')[0];
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error("deleteOnCloudinary Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error"
    });
  }
};