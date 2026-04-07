import mongoose from "mongoose";
import ServiceProvider from "../models/serviceProviders.model.js";
const connectDb = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    await ServiceProvider.createIndexes();
  } catch (error) {
    console.error("Error in connectDb:", error);
    console.log(error);
  }
};
export default connectDb;