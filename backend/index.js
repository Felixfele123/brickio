const express = require("express");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const mongoose = require('mongoose')
require('dotenv').config();
const app = express();
const cors = require('cors')
const validator = require("email-validator");
const nodeMailer = require('nodemailer')

app.use(express.urlencoded({extended:true}));
app.use(express.json());
app.use(cookieParser());
app.use(cors({origin: true, credentials: true}))

mongoose.connect("mongodb://localhost/brickio", { useUnifiedTopology: true, useNewUrlParser: true})
.then(() => { console.log('Connnected to MongoDB..', )})
.catch(err => console.error('Could not connect...', err));



const userSchema = new mongoose.Schema({
    email: {
        type: String,
        unique: true,
        required: true,
    },
    level: {
        type: Number,
    },
    rank: {
        type: Number,
    }
  });
  
const User = new mongoose.model('User', userSchema, 'users');

app.get('/userdata', async (req,res) => {
    const userdata = await User.find({email: req.body.email})
    res.send(userdata)
})


app.get('/login', async (req, res) => {
    const users = await User.find();
    res.send(users);
});

app.post('/login', async (req, res) =>{

    let email = req.body.email;
    console.log(email)
    let emailCheck = validator.validate(email);

    if(emailCheck){

        try {

            let code = getRandom();
            let hash = bcrypt.hashSync(code,12);
            
            let payload = {email:email, hash:hash};
            
            let token = jwt.sign(payload,process.env.FIRSTSECRET,{expiresIn:120});
                
            res.cookie("tmpToken", token, {maxAge: 120000, samsite:"strict", httpOnly:true});
            res.cookie("createUser",true,{maxAge:7200000});
        
                res.send({token});
                
                let transporter = nodeMailer.createTransport({
                    host: 'smtp.gmail.com',
                    port: 465,
                    secure: true,
                    auth: {
                        // should be replaced with real sender's account
                        user: 'verifybrickio@gmail.com',
                        pass: '123456test'
                    }
                });
                let mailOptions = {
                    // should be replaced with real recipient's account
                    to: req.body.email,
                    subject: "Identity verification",
                    body: code,
                    text: code
                };
                transporter.sendMail(mailOptions, (error, info) => {
                    if (error) {
                        return console.log(error);
                    }
                    console.log('Message %s sent: %s', info.messageId, info.response);
                });
        } catch (error) {
            res.status(409).send({error:error.message});
        }
    }else{
        res.send("email is unvalid")
    }
});


app.post("/confirmation", (req,res)=>{
    let code = req.body.code;

    let tmpToken = req.cookies.tmpToken;
   
    if(tmpToken)
    {
        try {
            verifiedToken = jwt.verify(tmpToken,process.env.FIRSTSECRET);

            let hash = verifiedToken.hash;
            bcrypt.compare(code,hash, async (err,success) => {

                if(success){
                    let payload = {email: verifiedToken.email};
                    console.log(payload)
                    res.cookie("tmpToken", "",{maxAge:3000});
                    let token = jwt.sign(payload,process.env.MAINSECRET,{expiresIn:"2h"})
                    res.cookie("token",token,{maxAge:720000000, httpOnly: true, samsite: "Strict"});
                    
                    // Cookie som endast är intressantför Klienten....
                    res.cookie("vueCheck",true,{maxAge:7200000});
                    
                    

                    // spara användare i databas...
                    let userdata = await User.find({email: verifiedToken.email})
                    

                    if (userdata === undefined || userdata.length == 0) {
                        const newUser = new User({
                            email: verifiedToken.email,
                            level: 1,
                            rank: 1
                        }) 

                        try {
                                newUser.save( async function(err){
                                    if (err) throw err;
                                    console.log("user created!")
                                    let userdata = await User.find({email: verifiedToken.email})
                                    res.send(userdata)
                                });
                            } catch (ex) {
                                for(field in ex.errors){
                                    console.log(ex.errors[field])
                            }
                        }
                    }else{
                    res.send(userdata);
                    console.log(userdata)
                    }


                   
                   
                }else{
                    res.send({error:"Confirmation failed"});
                }
            })
        
    } catch (error) {
        res.send(error.message)
    }
    }else{
        res.send("no cookie provided")
    }
});

function authenticateToken(req, res, next){

    let Token = req.cookies.Token;

    if(Token == null){
        return res.sendStatus(401)
    }

    jwt.verify(tmpToken, process.env.FIRSTSECRET, (err, user) => {
        if(err) return res.sendStatus(403)
        req.User = User
        next()
    })

}

function getRandom(){
    const crypto = require('crypto');
    const code = crypto.randomBytes(3).toString("hex");
    console.log(code);
    return code;
}


app.listen(3456, () => console.log("port 3456"))
