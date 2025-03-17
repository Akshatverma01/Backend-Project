import connectDB from "./db/index.js";
import dotenv from "dotenv";
import express from "express";

const app = express();
dotenv.config();

connectDB()
.then(()=>{
    app.on("error",(error)=>{
        console.error(`Error: ${error}`); 
        throw new Error(error);
    })
    app.listen(process.env.PORT||8000,()=>{
        console.log("Server is running on port "+process.env.PORT);
    })
})
.catch((error)=>{
    console.log("Mongoose connection error: ", error);
})




 








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