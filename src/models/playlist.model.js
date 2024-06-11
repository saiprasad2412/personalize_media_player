import mongoose from "mongoose";
import { Video } from "./video.model";

const playlistSchema=new mongoose.Schema({
    name:{
        type:String,
        required:true
    },
    description:{
        type:String,
        required:true
    },
    Video:[{
        type:mongoose.Schema.Types.ObjectId,
        ref:Video
    }],
    owner:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User"
    }
},{timestamps:true});

export const Playlist=mongoose.model("Playlist",playlistSchema)