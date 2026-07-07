import {createClient} from "redis";

const conn=createClient({
    port:6379,
    host:"localhost",
    user:"redis-server"
})
const script=`
local dte=tonumber(KEYS[1])
local maxtokens=tonumber(ARGV[1])
local bucket=KEYS[2]
local rateinterval=tonumber(ARGV[2])
local raterefill=tonumber(ARGV[3])

local ft=redis.call("GET",bucket)

if ft == false then 
redis.call("SET",bucket,maxtokens-1)
redis.call("SET","date",dte)
return {"bucket created with max tokens",(maxtokens-1)}
end

local lastdate=redis.call("GET","date")
local diff=dte-tonumber(lastdate)
local mth=math.floor((diff/rateinterval)*raterefill)
local new=math.min((mth+tonumber(ft)),maxtokens)

if new<0 then
return {"exhausted tokens",0}
end
if new==0 then
return {"exhausted tokens",0}
end
new=new-1
redis.call("SET",bucket,new)
redis.call("SET","date",dte)
return{"used token",new}
`

var c=null;
async function handle(req,res){
    try{
        if(!c){
            c=await conn.connect();
        }
        // console.log(req.session.user);
        if(!req.session.user){
            
            return res.status(409).json({"message":"user must be logged in"})
        }
        const dt=Date.now();
        const {max_token,user_id}=req.session.user;
        // console.log(user_id)
        await conn.eval(
            script,{keys:[`${dt}`,`${user_id}`],arguments:[`${max_token}`,"5000","1"]}
        ).then((data)=>{
            if(data[1]<0 ||data[1]==0){
                return res.status(409).json({"message":"generating token"})
            }
            if(data[1]>0){
            console.log(process());
                return res.status(200).json({"message":"Used one token"});
            }
            
        }).catch((error)=>{
            console.log(error);
            return res.status(500).json({"message":"Token generation failed"})
        })

    }catch(error){
        console.log(error);
        return res.status(500).json({"message":"server error"});
    }
}
function process(){
    return "you have used one token";
}
export default handle;