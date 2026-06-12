require('dotenv').config()
const jwt=require('jsonwebtoken')

const jwtSecret=process.env.JWT_SECRET || process.env.SECRET_KEY

exports.generateToken=(payload,passwordReset=false)=>{
    return jwt.sign(payload,jwtSecret,{expiresIn:passwordReset?process.env.PASSWORD_RESET_TOKEN_EXPIRATION:process.env.LOGIN_TOKEN_EXPIRATION})
}