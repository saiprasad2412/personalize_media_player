import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from  "jsonwebtoken"

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
export { registerUser ,loginUser ,logOutUser, refreshAcessToken,changeCurrentPassword,currentUser};
