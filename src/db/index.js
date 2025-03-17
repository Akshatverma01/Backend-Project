import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";

const connectDB = async () => {
  try {
    const connectionInstance = await mongoose.connect(`${process.env.MONGO_URI}/${DB_NAME}`);
    console.log(`Connected to database+ ${connectionInstance.connection.host}`);
  } catch (error) {
    console.error(error);
    throw new Error("Error connecting to database");
    process.exit(1); 
  }
}
export default connectDB;