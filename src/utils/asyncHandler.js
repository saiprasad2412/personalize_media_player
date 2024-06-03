const asyncHandler=(fn)=> async (req,res,next)=>{
    try {
        await fn(req,res,next)
        
    } catch (error) {
        res.status(err.code||500).json({message:error.message})
    }
}

export {asyncHandler}