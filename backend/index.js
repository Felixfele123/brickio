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
const socket = require('socket.io')


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
    username: {
        type: String,
        unique: true,
        required:  true,
        minlength: 3,
        maxlength: 12
    },
    level: {
        type: Number,
    },
    rank: {
        type: Number,
    }
  });
  
const User = new mongoose.model('User', userSchema, 'users');

app.get('/login', async (req, res) => {
    const users = await User.find();
    res.send(users);
});

app.post('/login', async (req, res) =>{

    let email = req.body.email;
    let username = req.body.username
    console.log(email)
    let emailCheck = validator.validate(email);

    if(emailCheck){
        let userdata = await User.find({email:email})

        if(userdata.length !== 0){
            try {

                let code = getRandom();
                let hash = bcrypt.hashSync(code,12);
                
                let payload = {email:email, username:username, hash:hash};
                
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
            res.send("no account associated to this email")
        }


    }else{
        res.send("email is unvalid")
    }
});

app.get("/userdata", async (req,res)=>{
    let token = req.cookies.token
    if(token){
        let verifiedToken = jwt.verify(token,process.env.MAINSECRET);
        let useremail = verifiedToken.email
        try {
            const userdata = await User.find({email: useremail})
            res.send(userdata)
        } catch (ex) {
            for(field in ex.errors){
                console.log(ex.errors[field])
            }
        }
    }else{
        res.send('no token')
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
                    let userdata = await User.find({email:verifiedToken.email})
                    res.cookie("user", userdata,{maxAge:7200000})

                    res.send(userdata)
                    
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

app.post('/registration', async (req, res) =>{

    let email = req.body.email;
    let Username = req.body.username
    console.log(email)
    let emailCheck = validator.validate(email);


    if(emailCheck){

        let userdata = await User.find({ $or: [ { email: email }, { username: Username } ] })
        //let username = await User.find({username: Username})

        if (userdata.length == 0){

            try {

                let code = getRandom();
                let hash = bcrypt.hashSync(code,12);
                
                let payload = {email:email, username:Username, hash:hash};
                
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
            res.send("email or username is already taken")
        }
    }else{
        res.send("email is unvalid")
    }
});

app.post("/regConfirmation", (req,res)=>{
    let code = req.body.code;

    let tmpToken = req.cookies.tmpToken;
   
    if(tmpToken)
    {
        try {
            verifiedToken = jwt.verify(tmpToken,process.env.FIRSTSECRET);

            let hash = verifiedToken.hash;
            bcrypt.compare(code,hash, async (err,success) => {

                if(success){
                    let payload = {email: verifiedToken.email, username: verifiedToken.username};
                    console.log(payload)
                    res.cookie("tmpToken", "",{maxAge:3000});
                    let token = jwt.sign(payload,process.env.MAINSECRET,{expiresIn:"2h"})
                    res.cookie("token",token,{maxAge:720000000, httpOnly: true, samsite: "Strict"});
                    
                    // Cookie som endast är intressantför Klienten....
                    res.cookie("vueCheck",true,{maxAge:7200000});

                    // spara användare i databas...
                    try {
                        const newUser = new User({
                            email: verifiedToken.email,
                            username: verifiedToken.username,
                            level: 1,
                            rank: 1
                        })
                                newUser.save( async function(err){
                                    if (err) throw err;
                                    console.log("user created!")
                                    let userdata = await User.find({email: verifiedToken.email})
                                    res.cookie("user",userdata,{maxAge:7200000});
                                    res.send(userdata)

                                });
                            } catch (ex) {
                                for(field in ex.errors){
                                    console.log(ex.errors[field])
                            }
                            res.send(error.message)
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



app.get("/logout", (req,res) => {
    res.cookie("token",null);
    res.clearCookie('token');
    res.send({mes: "cookie cleared"});
})

    function getRandom(){
        const crypto = require('crypto');
        const code = crypto.randomBytes(3).toString("hex");
        console.log(code);
        return code;
    }


const server = app.listen(3456, () => console.log("port 3456"))

var io = socket(server, { origins: '*:*'}); 






io.on("connection", socket => {
    // console.log('sid=', socket.id);
  
    socket.on("SEND_MESSAGE", data => {
      io.emit("MESSAGE", data);
      console.log(data)
    });
  });

