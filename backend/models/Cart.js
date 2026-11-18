const mongoose=require("mongoose")
const {Schema}=mongoose
const {createModel}=require("../database/memoryModel")

const cartSchema=new Schema({
    user:{
        type:Schema.Types.ObjectId,
        ref:"User",
        required:true,
    },
    product:{
        type:Schema.Types.ObjectId,
        ref:"Product",
        required:true
    },
    quantity:{
        type:Number,
        default:1,
    }
},{versionKey:false})

module.exports=createModel("Cart",cartSchema)