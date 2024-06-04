import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js";
import {User} from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import {ApiResponse} from "../utils/ApiResponse.js"

const registerUser=asyncHandler(async(req,res)=>{
    const {fullname , email , username ,password}=req.body;
    if(fullname==="" || email==="" || username==="" || password===""){
        throw new ApiError(400,"All fields are required")
    }

    const existedUser= User.findOne({
        $or:[{email},{username}]
    })
    if(existedUser){
        ApiError(409,"User already exists")
    }

    //req.file provided by multer middleware
    const avatarLocalPath=req.files?.avatar[0]?.path;
    const coverImageLocalPath=req.files?.coverImage[0]?.path;

    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar is required")
    }
    const avatar=await uploadOnCloudinary(avatarLocalPath)
    const coverImage=await uploadOnCloudinary(coverImageLocalPath)

    if(!avatar){
        throw new ApiError(400,"Avatar is required");
    }

    const user=await User.create({
        fullname,
        avatar:avatar.url,
        coverImage:coverImage?.url ||" ",
        email,
        username:username.toLowerCase(),
        password
    })
//we will not get password and refreshToken in createdUser becuase of following code
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if(!createdUser){
        throw new ApiError(400,"Something went wrong while creating user")
    }

    return res.status(201).json(
        new ApiResponse(200,"User created successfully",createdUser)
    )


})

export{registerUser}