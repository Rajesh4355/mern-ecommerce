require('dotenv').config()
const jwt=require('jsonwebtoken')

const jwtSecret=process.env.JWT_SECRET || process.env.SECRET_KEY || 'mern-shop-dev-secret-key'

exports.generateToken=(payload,passwordReset=false)=>{
    const expiresIn = passwordReset
        ? (process.env.PASSWORD_RESET_TOKEN_EXPIRATION || '2m')
        : (process.env.LOGIN_TOKEN_EXPIRATION || '30d')
    return jwt.sign(payload,jwtSecret,{expiresIn})
}