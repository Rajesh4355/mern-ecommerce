const mongoose=require("mongoose")
const {Schema}=mongoose
const {createModel}=require("../database/memoryModel")

const userSchema=new Schema({
    name:{
        type:String,
        required:true
    },
    email:{
        type:String,
        unique:true,
        required:true
    },
    password:{
        type:String,
        required:true
    },
    isVerified:{
        type:Boolean,
        default:false
    },
    isAdmin:{
        type:Boolean,
        default:false
    }
})

module.exports=createModel("User",userSchema)