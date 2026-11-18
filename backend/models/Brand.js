const mongoose=require("mongoose")
const {Schema}=mongoose
const {createModel}=require("../database/memoryModel")


const brandSchema=new Schema({
    name:{
        type:String,
        required:true
    }
})

module.exports=createModel("Brand",brandSchema)