import connectDB from "./db/index.js";
import dotenv from "dotenv";
import app from "./app.js";

// Correct dotenv path
dotenv.config({
  path: "./.env",
});

// Validate PORT environment variable
if (!process.env.PORT) {
  console.error("Error: PORT is not defined in the environment variables.");
}

connectDB()
  .then(() => {
    const port = process.env.PORT || 8000; // Use fallback port
    app.listen(port, () => {
      console.log("Server is running on port " + port); // Log the actual port
    });
  })
  .catch((error) => {
    console.error("Mongoose connection error: ", error);
    process.exit(1);
  });

// Iffy method
// import express from "express";
// const app = express();

//  (async()=>{
//     try {
//         await mongoose.connect(`${process.env.MONGO_URI}/${DB_NAME}`);
//         app.on("error", (error) => {console.error(`Error: ${error}`); throw ErrorEvent;});
//         app.listen(process.env.PORT, () => console.log("Server is running on port "+process.env.PORT));

//     } catch (error) {
//         console.error(error)
//         throw new Error('Error al conectar a la base de datos')
//     }
//  })()
