import { createClient } from "redis";
const script=`
local cnt=tonumber(ARGV[1]);
local current=redis.call("GET","tr");
if current==false  then 
  redis.call("INCR", "tr")
    redis.call("EXPIRE","tr",10)
    return {"complete"}
end

if tonumber(current) < cnt  then 
    redis.call("INCR", "tr")
    redis.call("EXPIRE","tr",10)
    return {"complete"}
end

if tonumber(current) > cnt then
    return {"later"}
end
return {"try again later"}
`
const conn=createClient({
port:6379,
host:"localhost",

})

var c=null;
async function execute(req,res){
    try{
        if(!c){
            c=await conn.connect();
        }
        await conn.eval(script, {
      arguments: ["5"]
    }).then((data)=>{
            console.log(data);
            return res.status(200).json({"message":"executed successfully"})
        }).catch((error)=>{
            console.log(error);
            return res.status(500).json({"message":"error executing lua"});
        })
    }
    catch(error){
        console.log(error.message);
        return res.status(500).json({"message":"server error"});
    }
}
export default execute;