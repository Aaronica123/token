import {createClient} from "redis";
var c=null;

const client= createClient({
    
    port:6379,
    host:"localhost",
    user:"redis-server"
});
client.l

async function cn(){
    if(!c){
        c=await client.connect();
       const x=await client.keys("rate");
        const k=await client.get("q");
       console.log(x.length);
       console.log(k);
        return console.log("first time connect");
    }
    else{
        return console.log("already connected");
    }
    
}

export async function th(req,res){
    try{
        const id=req.sessionID;
        console.log(id);
        new Promise((resolve,reject)=>{
            req.session.save((error)=>{
                if(error){
                    console.log(error);
                    reject(error);
                }
                else{
                    resolve();
                }
            })
        }).then(()=>{
            return res.status(200).json({"message":"saved session"});
        }).catch((error)=>{
            console.log(error)
                        return res.status(500).json({"message":"failed to connect"});
        })


    }catch(error){
        console.log(error.message);
        return res.status(500).json({'message':"server error"})
    }
}
export default cn;
