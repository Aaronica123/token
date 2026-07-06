import app from "./app.js";


async function start(){
    try{
        
    app.listen(3001);
    console.log("app started");
   
    // await cn();
    // await cn();
    }
    catch(error){
        console.log(error.message);
    }
}
start();