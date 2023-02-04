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
import User from "../models/User.js";
import Post from "../models/Post.js";
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


/* CREATE */
export const createPost = async (req, res) => {
  try {
    const { userId, description, picturePath } = req.body;
    const user = await User.findById(userId);
    const newPost = new Post({
      userId,
      firstName: user.firstName,
      lastName: user.lastName,
      location: user.location,
      description,
      userPicturePath: user.picturePath,
      picturePath,
      likes: {},
      comments: [],
    });
    await newPost.save();

    const post = await Post.find();
    res.status(201).json(post);
  } catch (err) {
    res.status(409).json({ message: err.message });
  }
};

/* READ */
export const getFeedPosts = async (req, res) => {
  try {
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
    }
    
    res.status(200).json(post);
  } catch (err) {
    res.status(404).json({ message: err.message });
  } 
};

export const getUserPosts = async (req, res) => {
  try {
    const { userId } = req.params;
    const post = await Post.find({ userId });


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
    }

    res.status(200).json(post);
  } catch (err) {
    res.status(404).json({ message: err.message });
  }
};

/* UPDATE */
export const likePost = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    const post = await Post.findById(id);
    const isLiked = post.likes.get(userId);

    if (isLiked) {
      post.likes.delete(userId);
    } else {
      post.likes.set(userId, true);
    }

    const updatedPost = await Post.findByIdAndUpdate(
      id,
      { likes: post.likes },
      { new: true }
    );


 
      const getObjectParams = {
       Bucket: process.env.AWS_BUCKET_NAME ,
       Key: updatedPost.picturePath,
      }
 
   const command = new GetObjectCommand(getObjectParams)
   const url = await getSignedUrl(s3, command, { expiresIn: 3600 })
   updatedPost.imageUrl = url

     
   
     const getParams = {
      Bucket: process.env.AWS_BUCKET_NAME ,
      Key: updatedPost.userPicturePath,
     }

  const command1 = new GetObjectCommand(getParams)
  const url1 = await getSignedUrl(s3, command1, { expiresIn: 3600 })
  updatedPost.userimageUrl = url1



    res.status(200).json(updatedPost);
  } catch (err) {
    res.status(404).json({ message: err.message });
  }
};
