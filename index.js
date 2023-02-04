import express from "express";
import bodyParser from "body-parser";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import helmet from "helmet";
import morgan from "morgan";
import path from "path";
import { fileURLToPath } from "url";
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import postRoutes from "./routes/posts.js";
import { register } from "./controllers/auth.js";
import { createPost } from "./controllers/posts.js";
import { verifyToken } from "./middleware/auth.js";
import User from "./models/User.js";
import Post from "./models/Post.js";
import { users, posts } from "./data/index.js";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import crypto from 'crypto'
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import sharp from 'sharp'
import bcrypt from 'bcrypt'
/* CONFIGURATIONS */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config();
const app = express();
app.use(express.json());
app.use(helmet());
app.use(helmet.crossOriginResourcePolicy({ policy: "cross-origin" }));
app.use(morgan("common"));
app.use(bodyParser.json({ limit: "30mb", extended: true }));
app.use(bodyParser.urlencoded({ limit: "30mb", extended: true }));
app.use(cors());
app.use("/assets", express.static(path.join(__dirname, "public/assets")));

/* FILE STORAGE */
const bucketName = process.env.AWS_BUCKET_NAME;
const bucketRegion = process.env.AWS_BUCKET_REGION;
const accessKey = process.env.AWS_ACCESS_KEY;
const secretAccessKey = process.env.AWS_SECRET_KEY;

const s3 = new S3Client({

  region: bucketRegion,
  credentials: {
    accessKeyId: accessKey,
    secretAccessKey: secretAccessKey
  },
})



const storage = multer.memoryStorage();
const upload = multer({ storage: storage });


/* ROUTES WITH FILES */
const generateFileName = (bytes = 32) => crypto.randomBytes(bytes).toString('hex')

app.post("/auth/register", upload.single("picture"), async (req, res) => {

  try {
    const file = req.file
    const fileName = generateFileName()
    const params = {
      Bucket: bucketName,
      Body: file.buffer,
      Key: fileName,
      ContentType: file.mimetype
    }


    await s3.send(new PutObjectCommand(params))


    const {
      firstName,
      lastName,
      email,
      password,
      friends,
      location,
      occupation,
    } = req.body;

    const salt = await bcrypt.genSalt();
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = new User({
      firstName,
      lastName,
      email,
      password: passwordHash,
      picturePath: fileName,
      friends,
      location,
      occupation,
      viewedProfile: Math.floor(Math.random() * 10000),
      impressions: Math.floor(Math.random() * 10000),
    });

    const getObjectParams = {
      Bucket: process.env.AWS_BUCKET_NAME ,
      Key: newUser.picturePath,
     }

  const command = new GetObjectCommand(getObjectParams)
  const url = await getSignedUrl(s3, command, { expiresIn: 3600 })
  newUser.imageUrl = url



    const savedUser = await newUser.save();

    res.status(201).json(savedUser);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


app.post("/posts", upload.single("picture"), async (req, res) => {
  try {

    const file = req.file
    const fileName = generateFileName()
    const params = {
      Bucket: bucketName,
      Body: file.buffer,
      Key: fileName,
      ContentType: file.mimetype
    }


    await s3.send(new PutObjectCommand(params))


    const { userId, description } = req.body;
    const user = await User.findById(userId);
    const newPost = new Post({
      userId,
      firstName: user.firstName,
      lastName: user.lastName,
      location: user.location,
      description,
      userPicturePath: user.picturePath,
      picturePath: fileName,
      likes: {},
      comments: [],
    
    });


    await newPost.save();
    const post = await Post.find();


    for(const pos of post){
       const getObjectParams = {
        Bucket: process.env.AWS_BUCKET_NAME ,
        Key: pos.picturePath,
       }
  
    const command = new GetObjectCommand(getObjectParams)
    const url = await getSignedUrl(s3, command, { expiresIn: 3600 })
    pos.imageUrl = url

      }
    for(const pos of post){
      const getObjectParams = {
       Bucket: process.env.AWS_BUCKET_NAME ,
       Key: pos.userPicturePath,
      }
 
   const command = new GetObjectCommand(getObjectParams)
   const url = await getSignedUrl(s3, command, { expiresIn: 3600 })
   pos.userimageUrl = url

   await newPost.save();
    console.log(url);
      }

      
    
    res.status(201).json(post);
  } catch (err) {
    res.status(409).json({ message: err.message });
  }
})





/* ROUTES */
app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/posts", postRoutes);

/* MONGOOSE SETUP */
const PORT = process.env.PORT || 6001;
mongoose
  .connect(process.env.MONGO_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    app.listen(PORT, () => console.log(`Server Port: ${PORT}`));

    /* ADD DATA ONE TIME */
    // User.insertMany(users);
    // Post.insertMany(posts);
  })
  .catch((error) => console.log(`${error} did not connect`));
