import { Client } from "pg";
import { createClient } from "redis";

const clnt=createClient({
    port:6179,
    host:"localhost",
    user:"redis-server"
    
})

var c=null;
const count=10;
const arr=5;
async function red(req,res){
    try{
        if(!c){
            c=await clnt.connect();
        };
        const current=await clnt.get("count");

        const ink=await clnt.keys("q_array");
        console.log(ink.length)
        if(ink.length==5){
        await clnt.lRange("q_array" , 0 ,-1).then((data)=>{
            console.log(data.length);
            if(data.length==arr){
                console.log("length is "+data.length);
            var track=0;
            async function pop(){
                console.log("length is "+data.length);
                await clnt.lPop("q_array");
                q(1);
                // await clnt.expire("q_array",10);
                //  res.status(200).json({"message":"Popped from array"})
                console.log("popped array");
            }
            setTimeout(()=>{
                data.length!=0?pop():""},1000)
            }
        }).catch((error)=>{
            console.log(error);
        })
    }else  if(current==null||current<count){
            await clnt.incr("count");
            var c1=current;
            process(c1);
            await clnt.expire("count",10);
            return res.status(200).json({"message":"executed"});
        }
        else{
            const w_arr=await clnt.lLen("q_array");
            if(w_arr<arr){
                async function ch(){
                    await clnt.incr("count");
                    await clnt.rPush("q_array",current);
                }
                ch();
                
                return res.status(201).json({"message":"added to queue"})
            }
            else{
            return res.status(409).json({"message":"full try after 1 minute"});
            }
        }
        
        

    }catch(error){
        console.log(error.message);
        return res.status(500).json({"message":"Server error"});
    }

}

function q(current){
    try{
        // console.log(current-1);
        // setTimeout(q,1000);
        return console.log("item processed from queue");
    }
    catch(error){
        console.log(error.message);
    }
}
function process(current){
    try{
        console.log("count is " + current);
    }
    catch(error){
        console.log(error.message);
    }
}
export default red;