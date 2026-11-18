const mongoose=require("mongoose")
const {Schema}=mongoose
const {createModel}=require("../database/memoryModel")

const otpSchema=new Schema({
    user:{
        type:Schema.Types.ObjectId,
        ref:"User",
        required:true
    },
    otp:{
        type:String,
        required:true
    },
    expiresAt:{
        type:Date,
        required:true
    },
})



module.exports=createModel("OTP",otpSchema)