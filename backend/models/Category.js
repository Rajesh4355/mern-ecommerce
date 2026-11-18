const mongoose=require("mongoose")
const {Schema}=mongoose
const {createModel}=require("../database/memoryModel")


const categorySchema=new Schema({
    name:{
        type:String,
        required:true
    }
})

module.exports=createModel("Category",categorySchema)