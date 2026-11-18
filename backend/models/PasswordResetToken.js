const mongoose=require("mongoose")
const {Schema}=mongoose
const {createModel}=require("../database/memoryModel")

const passwordResetTokenSchema=new Schema({
    user:{
        type:Schema.Types.ObjectId,
        ref:"User",
        required:true
    },
    token:{
        type:String,
        required:true
    },
    expiresAt:{
        type:Date,
        required:true
    },
})



module.exports=createModel("PasswordResetToken",passwordResetTokenSchema)