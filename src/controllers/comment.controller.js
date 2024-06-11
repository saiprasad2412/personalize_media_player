import mongoose, { isValidObjectId } from "mongoose"
import {Comment} from "../models/comment.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import { User } from "../models/user.model.js"
import { Video } from "../models/video.model.js"

const getVideoComments = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    const { page = 1, limit = 10 } = req.query

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "video Id is not available")
    }

    const video = await Video.findById(videoId)
    if (!video) {
        throw new ApiError(404, "Video not found with this video Id or Invalid video Id")
    }

    const pageLimit = parseInt(limit)
    const pageNumber = parseInt(page)
    const offset = (pageNumber - 1) * pageLimit
    const skip = offset

    const comments = await Comment.aggregate([
        {
            $match: {
                video: new mongoose.Types.ObjectId(videoId)  //i'll give all comments witht this videoId
            }
        },

        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
                pipeline: [
                    {
                        $project: {
                            fullname: 1,
                            username: 1,
                            avatar: 1
                        }
                    }
                ]
            }
        },
        {
            $addFields: {
                owner: {
                    $first: "$owner" //return directly object not in array
                }
            }
        },
        {
            $skip: skip
        },
        {
            $limit: pageLimit
        }

    ])

    const totalComments = await Comment.countDocuments({ video: videoId })
    const totalPages = Math.ceil(totalComments / pageLimit)

    return res
        .status(200)
        .json(
            new ApiResponse(200, { comments, totalComments, totalPages }, "video all Comments fetched Sucessfully!")
        )

})

const addComment = asyncHandler(async (req, res) => {
    // TODO: add a comment to a video
    const {content}=req.body;
    const { videoId } = req.params;

    if(!req.user?._id){
        throw new ApiError(404, "requested userId not found")
    }
    const user= await User.findById(req.user._id)
    if(!isValidObjectId(user)){
        throw new ApiError(404, "requested userId not found")
    }
    if (content.trim() === "") {
        throw new ApiError(400, "content is required and should not be empty")
    }

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "video Id is not available")
    }
    const video= await Video.findById(videoId);
    if(!isValidObjectId(video)){
        throw new ApiError(404, "requested video not found")
    }
    const comment= await comment.create({
        content,
        video:videoId,
        owner: user
    })
    return res.status(200)
    .json(new ApiResponse(200, comment, "comment created successfully"))
})

const updateComment = asyncHandler(async (req, res) => {
    // TODO: update a comment
    const {commentId} = req.params;
    const {newCommentData}=req.body;

    
    const comment=await Comment.findById(commentId);
    if(!isValidObjectId(comment)){
        throw new ApiError(400, "comment Id is not available")
    }

    const newComment = Comment.findByIdAndUpdate(commentId,{
        $set:{
            content:newCommentData
        }
    },{
        new:true
    })

    if (!newComment) {
        throw new ApiError(400, "Error while updating Comment")
    }

    return res
        .status(200)
        .json(
            new ApiResponse(200, updatedComment, "Comment updated sucessfully")
        )


    
})

const deleteComment = asyncHandler(async (req, res) => {
    // TODO: delete a comment
    const {commentId} = req.params;
    const comment=await Comment.findById(commentId);
    if(!isValidObjectId(comment)){
        throw new ApiError(400, "comment Id is not available")
    }
    const deleteComment = await Comment.findByIdAndDelete(commentId)

    if (!deleteComment) {
        throw new ApiError(400, "Error while deleting comment")
    }

    return res
        .status(200)
        .json(
            new ApiResponse(200, deleteComment, "Comment delted Sucessfully !")
        )
})

export {
    getVideoComments, 
    addComment, 
    updateComment,
     deleteComment
    }