import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from  "jsonwebtoken"
import mongoose from "mongoose";

const generateAcessAndRefereshToken = async (userId) => {
  try {
    const user= await User.findById(userId);
    const accessToken = await user.generateAccessToken();
    const refreshToken = await user.generateRefreshToken();

    user.refreshToken=refreshToken;
    await user.save({validateBeforeSave:false});
    return {accessToken ,refreshToken}
  } catch (error) {
    throw new ApiError('500',"Error while generating access and refresh token")
    
  }
}

const registerUser = asyncHandler(async (req, res) => {
  const { fullname, email, username, password } = req.body;
  if (fullname === "" || email === "" || username === "" || password === "") {
    throw new ApiError(400, "All fields are required");
  }

  const existedUser = await User.findOne({
    $or: [{ email }, { username }],
  });
  if (existedUser) {
    ApiError(409, "User already exists");
  }

  //req.file provided by multer middleware
  const avatarLocalPath = req.files?.avatar[0]?.path;
  let coverImageLocalPath;
  if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
      coverImageLocalPath = req.files.coverImage[0].path
  }

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar is required");
  }
  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!avatar) {
    throw new ApiError(400, "Avatar is required");
  }

  const user = await User.create({
    fullname,
    avatar: avatar.url,
    coverImage: coverImage?.url || " ",
    email,
    username: username.toLowerCase(),
    password,
  });
  //we will not get password and refreshToken in createdUser becuase of following code
  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw new ApiError(400, "Something went wrong while creating user");
  }

  return res
    .status(201)
    .json(new ApiResponse(200, "User created successfully", createdUser));
});  
const loginUser =asyncHandler(async(req,res)=>{
  const {email ,username , password}=req.body;


  if(!email && !password){
    throw new ApiError(400,"All fields are required")
  } 

  const user = await User.findOne({$or:[{email},{username}]});
  if(!user){  
    throw new ApiError(400,"User not found");
  }
  const isPasswordValid=await user.isPasswordCorrect(password);
  if(!isPasswordValid){
    throw new ApiError(401,"Invalid Login Credentials");
  }

  const {accessToken,refreshToken}=await generateAcessAndRefereshToken(user._id)

  const loginUser=await User.findById(user._id).select("-password -refreshToken");

  const options={
    httpOnly:true,
    secure:true
  }
  return res.status(200)
  .cookie("accessToken",accessToken,options)
  .cookie("refreshToken",refreshToken,options)
  .json(new ApiResponse(200,{
    user:loginUser,
    accessToken, refreshToken
  }, "User logged in successfully"))
  
}) 
const logOutUser = asyncHandler(async(req, res)=>{
  await User.findByIdAndUpdate(req.user._id, {refreshToken: undefined})
  const options={
    httpOnly:true,
    secure:true
  }
  return res.status(200)
  .clearCookie("accessToken",options)
  .clearCookie("refreshToken",options)
  .json(new ApiResponse(200,{},"User logged out successfully"))

})
const refreshAcessToken= asyncHandler(async(req,res)=>{
  const incomingRefreshToken=req.cookies.refreshToken || req.body.refreshAcessToken;

  if(!incomingRefreshToken){
    throw new ApiError(401,"Unauthorized request")
  }
  try {
    const decodedToken =  jwt.verify(incomingRefreshToken,process.env.REFRESH_TOKEN_SECRET)
    const user = await User.findById(decodedToken?._id)
    if(!user){
      throw new ApiError(401,"Invalid refresh token")}
      if(incomingRefreshToken !==user?.refreshToken){
        throw new ApiError(401,"Refresh Token is expired or used")
      }
      const options={
        httpOnly:true,
        secure:true
      }
      const {accessToken ,newRefreshToken}=await generateAcessAndRefereshToken(user._id)
  
      return res.status(200)
      .cookie("accessToken",accessToken,options)
      .cookie('refreshToken',newRefreshToken,options)
      .json(new ApiResponse(200,{accessToken,refreshToken:newRefreshToken},"Acess token refreshed successfully"))
  }
   catch (error) {
    throw new ApiError(401,error?.message || "Invalid refresh token")
    
  }})

const changeCurrentPassword= asyncHandler(async (req,res)=>{
  const {oldPassword , newPassword}=req.body

  const user=await User.findById(req.user?._id)
  const isPassCorrect=await user.isPasswordCorrect(oldPassword);

  if(!isPassCorrect){
    throw new ApiError(400,"Old password is incorrect")
  }
  user.password=newPassword
  await user.save({validateBeforeSave:false})
  return res.status(200).json(new ApiResponse(200,{},"Password changed successfully"))
})
const currentUser= asyncHandler(async (req,res)=>{
  return res.status(200).json(200,{user:req.user},"User fetched successfully")
})
const updateAccountDetails = asyncHandler(async(req, res) => {
  const {fullName, email} = req.body

  if (!fullName || !email) {
      throw new ApiError(400, "All fields are required")
  }

  const user = await User.findByIdAndUpdate(
      req.user?._id,
      {
          $set: {
              fullName,
              email: email
          }
      },
      {new: true}
      
  ).select("-password")

  return res
  .status(200)
  .json(new ApiResponse(200, user, "Account details updated successfully"))
});

const updateUserAvatar = asyncHandler(async(req, res) => {
  const avatarLocalPath = req.file?.path

  if (!avatarLocalPath) {
      throw new ApiError(400, "Avatar file is missing")
  }


  const avatar = await uploadOnCloudinary(avatarLocalPath)

  if (!avatar.url) {
      throw new ApiError(400, "Error while uploading on avatar")
      
  }

  const user = await User.findByIdAndUpdate(
      req.user?._id,
      {
          $set:{
              avatar: avatar.url
          }
      },
      {new: true}
  ).select("-password")

  return res
  .status(200)
  .json(
      new ApiResponse(200, user, "Avatar image updated successfully")
  )
})

const updateUserCoverImage = asyncHandler(async(req, res) => {
  const coverImageLocalPath = req.file?.path

  if (!coverImageLocalPath) {
      throw new ApiError(400, "Cover image file is missing")
  }

  const coverImage = await uploadOnCloudinary(coverImageLocalPath)

  if (!coverImage.url) {
      throw new ApiError(400, "Error while uploading on avatar")
      
  }

  const user = await User.findByIdAndUpdate(
      req.user?._id,
      {
          $set:{
              coverImage: coverImage.url
          }
      },
      {new: true}
  ).select("-password")

  return res
  .status(200)
  .json(
      new ApiResponse(200, user, "Cover image updated successfully")
  )
})

const getUserChannelProfile = asyncHandler(async(req, res) => {
  const {username} = req.params;
  if(!username?.trim()){
    throw new ApiError(400, "Username is missing")
  }

  // User.find({username}) ---->Where qla

  //aggregation pipeline
  const channel=await User.aggregate([
    {
      $match:{
        username:username?.toLowerCase()
      }
    },
    {
      $lookup:{
        from:"subscriptions",
        localField:"_id",
        foreignField:"channel",
        as:"subscribers"
      }
    },
    {
      $lookup:{
        from:"subscriptions",
        localField:"_id",
        foreignField:"subscriber",
        as:"subscribedTo"
      }
    },
    {
      $addFields:{
        subscribersCount:{
          $size:"$subscribers"
        },
        subscribedToCount:{
          $size:"$subscribedTo"
        },
        idSubscribed:{
          $cond:{
            if:{$in:[req.user?._id,"$subscribers.subscriber"]},
            then:true,
            else:false
          }
        }

      }
    },
    {
      $project:{
        fullname:1,
        username:1,
        avatar:1,
        coverImage:1,
        email:1,
        subscribersCount:1,
        subscribedToCount:1,
        idSubscribed:1
      }
    }
  ])
  if(!channel?.length){
    throw new ApiError(404, "Channel not found")
  }
  return res
  .status(200)
  .json(new ApiResponse(200,channel[0],"Channel fetched successfully"))
})

const getWatchHistory = asyncHandler(async(req, res) => {
  const user = await User.aggregate([
      {
          $match: {
              _id: new mongoose.Types.ObjectId(req.user._id)
          }
      },
      {
          $lookup: {
              from: "videos",
              localField: "watchHistory",
              foreignField: "_id",
              as: "watchHistory",
              pipeline: [
                  {
                      $lookup: {
                          from: "users",
                          localField: "owner",
                          foreignField: "_id",
                          as: "owner",
                          pipeline: [
                              {
                                  $project: {
                                      fullName: 1,
                                      username: 1,
                                      avatar: 1
                                  }
                              }
                          ]
                      }
                  },
                  {
                      $addFields:{
                          owner:{
                              $first: "$owner"
                          }
                      }
                  }
              ]
          }
      }
  ])

  return res
  .status(200)
  .json(
      new ApiResponse(
          200,
          user[0].watchHistory,
          "Watch history fetched successfully"
      )
  )
})
export { registerUser ,
  loginUser ,
  logOutUser, 
  refreshAcessToken,
  changeCurrentPassword,
  currentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
  getUserChannelProfile,
  getWatchHistory
};
