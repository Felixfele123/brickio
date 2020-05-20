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

mongoose.set('useNewUrlParser', true);
mongoose.set('useFindAndModify', false);
mongoose.set('useCreateIndex', true);

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
    },
    xp: {
        type: Number,
    },
    coins: {
        type: Number,
    },
    
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
                
                let token = jwt.sign(payload,process.env.FIRSTSECRET,{expiresIn:12000});
                    
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
    try {
     let token = req.cookies.token
    if(token){
        let verifiedToken = jwt.verify(token,process.env.MAINSECRET);
        let useremail = verifiedToken.email
            const userdata = await User.find({email: useremail})
            res.send(userdata)
    }else{
        res.send('no token')
    }         
    } catch (error) {
        console.log(error)
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
                    res.cookie("vueCheck",true,{maxAge:720000000});
                    
                    // spara användare i databas...
                    let userdata = await User.find({email:verifiedToken.email})
                    res.cookie("user", userdata,{maxAge:720000000})

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
                            rank: 1,
                            xp: 0,
                            coins: 0,
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

app.post("/updateUserdata", async(req, res)=>{
    let token = req.cookies.token
    let xpIncrease = parseInt(req.body.xp)
    let coinIncrease = parseInt(req.body.coins)
    if(token){
        let verifiedToken = jwt.verify(token,process.env.MAINSECRET);
        let useremail = verifiedToken.email
        try {
            let userdata = await User.find(
                {email: useremail})
                res.send(userdata)
                
                let totalXp = userdata[0].xp + xpIncrease
                let potens = userdata[0].level - 1
                let topXp = Math.floor(Math.pow(1.3, potens) * 1000)
                if(totalXp > topXp){
                    let remainingXp = totalXp - topXp
                    console.log(remainingXp)
                    await User.update({email: useremail}, {$inc:{level:1, coins:coinIncrease}, xp: remainingXp})  
                    console.log("success")                  
                }else{
                    await User.update( {email: useremail}, {$inc:{xp:xpIncrease, coins:coinIncrease}})
                    console.log("success")
                }
           /* await User.update(
                {email: useremail}, {$inc:{xp:xpIncrease}})
            
                
                let xpTop = 1000 * Math.pow(1.3, userdata[0].level)
                if(userdata[0].xp > xpTop){
                    await User.update(
                        {email: useremail}, {$inc:{level:1}, xp: remainingXp}) 
                }*/
        } catch (ex) {
            for(field in ex.errors){
                console.log(ex.errors[field])
            }
        }
    }else{
        res.send('no token')
    }
})



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


const server = app.listen(3456, () => console.log("port 3456"));



var io = socket(server, { origins: '*:*'}); 

/*class Player {
    constructor(id, username, x){
        this.id = id
        this.username = username
        this.x = x
        this.lastUpdateTime = Date.now();

    }
    setXpos(x){
        this.x = x
    }
    serializeForUpdate(){
        return{
            x: this.x,
            id: this.id,
            t: Date.now()
        }
    }
}
class Game {
    constructor(){
        this.sockets = {}
        this.players = {}
        setInterval(this.update.bind(this), 1000 / 0.1);
    }
    handleInput(data,socket){
        if (this.players[socket.id]) {
            this.players[socket.id].setXpos(data);
          }
    }
    addPlayer(socket, username){
        this.sockets[socket.id] = socket
        const x = 200
        this.players[socket.id] = new Player(socket.id, username, x);
        console.log('added player')
        console.log(this.players)
    }
    removePlayer(socket) {
        delete this.sockets[socket.id];
        delete this.players[socket.id];
        console.log(this.players)
      }
    update(){
        Object.keys(this.sockets).forEach(playerID => {
            const socket = this.sockets[playerID];
            const player = this.players[playerID];
            socket.emit('GAME_UPDATE', this.createUpdate(player));
          });
    }
    createUpdate(){
        let update = []
        Object.keys(this.players).forEach(element => {
            update.push(this.players[element].serializeForUpdate())
        });
        return update
    }
}

io.on("connection", socket => {
    socket.on("SEND_MESSAGE", data => {
      io.emit("MESSAGE", data);
    });
  });

/*io.on("connection", socket => {
    console.log('sid=', socket.id);

    socket.on("SEND_GAMEREQUEST", data => {
        joinGame(socket, data)
    });
    socket.on("LEAVE_GAME", disconnect);
    socket.on("SEND_MESSAGE", data => {
      io.emit("MESSAGE", data);
    });
    socket.on("SEND_MOUSEPOS", data => {
      handleInout(data, socket)
    });
  });
const game = new Game();

function joinGame(socket, data){
    game.addPlayer(socket, data.userID);
}

function disconnect(){
    game.removePlayer(this)
}

function handleInout(data, socket){
    game.handleInput(data, socket)
}

function sendGamerequest(data){
    for(i = 0; i < players.length; i++){
        if(players[i].userID == null){
            players[i].userID = data.userID;
            io.emit("SESSION_ID", players[i].id);
            console.log(players)
            break;
        }    
    }
}
*/