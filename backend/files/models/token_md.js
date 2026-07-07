import {createClient} from "redis";

const conn=new createClient({
    port:6379,
    host:"localhost",
    user:"redis-server"
})
const script=`
local date=tonumber(KEYS(1))
local maxtokens=tonumber(ARGV(1))
local bucket=KEYS(2)
local rateintervall=tonumber(ARGV(2))
local raterefill=tonumber(ARGV(3))

local ft=redis.call("GET",bucket)

if ft == false then 
redis.call("SET",bucket,maxtokens-1)
redis.call("SET","date",date)
return {"bucket created with max tokens"}
end

local lastdate=redis.call("GET","date")
local diff=date-tonumber(lastdate)
local mth=math.floor((diff/rateintervall)*raterefill)
local new=math.min((mth+tonumber(ft)),maxtokens)

if new<0 then
return {"exhausted tokens"}

new=new-1
redis.call("SET",bucket,new)
redis.call("SET","date",date)
return{"used token",new}
`