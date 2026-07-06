import express from "express";
import session from "express-session";
import { th } from "./redis.js";
import {Client} from "pg";
import pgSession from "connect-pg-simple";
import red from "./file.js";
import token from "./trial/token.js";
import execute from "./trial/scrpt.js";
import { create } from "./models/user.js";
import {login }from "./models/user.js";
const app=express();
const pg=new Client({
    user:"postgres",
    host:"localhost",
    password:"Aaronica",
    port:5432,
    database:"sessions"
})
await pg.connect();
const pd=pgSession(session);
const config={
    saveUninitialized:false,
    secret:"Aaronica",
    resave:false,
    store:new pd({
    createTableIfMissing:true,
    pool:pg,
    tableName:"red_sessions",
    pruneSessionInterval:120
    })
};
app.use(session(config));
app.use(express.json());
// app.post("/red",th);
app.post("/th",red);
app.post("/exec",execute);
app.post("/token",token);
app.post("/create",create);
app.post("/login",login);

export default app;
