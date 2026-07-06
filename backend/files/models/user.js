import { Client } from "pg";
import {configDotenv} from "dotenv";
import bcrypt from "bcrypt";
configDotenv();
const cr=new Client({
    host:"localhost",
    port:5432,
    password:process.env.password,
    user:"postgres",
    database:"sessions"
})
var tr_c=null;
export async function create(req,res){
    try{
        if(!tr_c){
            tr_c=await cr.connect();
        }
        const {user_id,user_name,role,password}=req.body;
        if(!user_id||!user_name||!role||!password){
            return res.status(400).json({"message":"Provide all fields"})
        }
        const enc=await bcrypt.hash(password,10);
        await cr.query("create type role as enum ('admin','staff','director')").then((data)=>{
        console.log("created type");
        }).catch((error)=>{
            if(error.code==42710){
                console.log("created type already");
            }
        })
        await cr.query("create table if not exists rate_user (user_id int, user_name varchar(100),role role, password varchar(255));");
        await cr.query("alter table rate_user add constraint pk primary key(user_id);").then(()=>{console.log("created pr key")}).catch((error)=>{
            if(error.code=="42P16"){
                console.log("primary key already created");
            }
            
            
        });
        await cr.query(`insert into rate_user values ($1 ,$2, $3, $4);`,[user_id,user_name,role,enc]).then(()=>{
            return res.status(201).json({"message":"created user success"})
        }).catch((error)=>{
            
            if(error.code==23505){
                return res.status(409).json({"message":"entering duplicates"})
            }
            return res.status(500).json({"message":"failed to create"})
        });
        
    }catch(error){
        // console.log(error.code);
        
        return res.status(500).json({"message":"server error"})
    }
}
export async function login(req,res){
    try{
        const {user_id,password}=req.body;
        if(!user_id||!password){
            return res.status(400).json({"message":"Enter all fields"})
        }
        const c=await cr.query(`select password,role,user_name from rate_user where user_id = $1`,[user_id]);
        // console.log(c);
        if(c.rows.length>0){
            // console.log(c);
            const y=c.rows[0].password;
            console.log(y);
            // await bcrypt.compare(password,y).then(()=>{
            //     console.log("success")
            // }).catch((error)=>{
            //     console.log(error)
            //      return res.status(409).json({"message":"Failed to verify"})
            // });

            const b=await bcrypt.compare(password,y);
            if(b){
                console.log("verified");
                return res.status(200).json({"message":"verified"})
            }
            else{
                return res.status(500).json({'message':"Unverified"})
            }
            // req.session.user={
            //     token:10,
            //     role:c.role,
            //     user_name:c.user_name
            // }
            // new Promise((resolve,reject)=>{
            //     req.session.save((error)=>{
            //         if(error){
            //             console.log(error)
            //             reject(error);
            //         }
            //         else{
            //             resolve();
            //         }
            //     })
            // }).then(()=>{
            //     return res.status(201).json({"message":"User saved"})
            // }).catch((error)=>{
            //     console.log(error);
            //     return res.status(500).json({"message":"failed to save"})
            // })
        }
        else{
            return res.status(404).json({"message":"user not found"})
        }
        
    }
    catch(error){
        console.log(error.message);
        return res.status(500).json({"message":"Server error"})
    }
}
