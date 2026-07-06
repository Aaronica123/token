import { createClient } from "redis";

const script=`
local bucket=KEYS[1]
local dt=tonumber(ARGV[1])

local maxtokens=tonumber(ARGV[2])
local refill_interval=tonumber(KEYS[2])
local refill_rate=tonumber(KEYS[3])
local exp=tonumber(KEYS[4])

local ft=redis.call("GET",bucket)

if ft == false then
redis.call("SET",bucket,maxtokens)
redis.call("SET","date",dt)
return {"bucket created"}

end
if tonumber(ft) == maxtokens then
local m=tonumber(ft)-1
redis.call("SET",bucket,m)
redis.call("SET","date",dt)
 return {"bucket is full"} 

end
local date_add=redis.call("GET","date")
local diff=dt-tonumber(date_add)
local mth=math.floor((diff/refill_interval)*refill_rate)
local tko=math.min((mth+tonumber(ft)),maxtokens)

if(tko<1) then
return {"Exhausted tokens",diff,mth}
end
local new=tko-1
redis.call("SET",bucket,new)
redis.call("SET","date",dt)
return {"token spent",date_add,dt,mth}
`
const conn=createClient({
    host:"localhost",
    port:6379
})
var c=null;
async function token(req,res){
    try{
        if(!c){
            await conn.connect().then(()=>{
                console.log("connection done")
            }).catch((error)=>{
                console.log(error)
            });
            c=true;
        }
        const dt=Date.now();
        await conn.eval(script,{keys:["token_q","5000","1","1"],
            arguments:[`${Date.now().toString()}`,"5"]
        }).then((data)=>{
            console.log(data);
            return res.status(200).json({"message":data[0]})
            
        }).catch((error)=>{
            console.log(error);
            return res.status(500).json({"message":"failed server"})
        })
    }
    catch(error){
        console.log(error);
        return res.status(500).json({"message":"Server error"})
    }
}
export default token;