const axios = require("axios");
const config = require("./config");


const client = axios.create({

  baseURL: config.X4G_BASE_URL,

  timeout: 20000,

  headers:{
    "X-API-Key": config.X4G_BOT_API_KEY,
    "Content-Type":"application/json"
  }

});



// ساخت کانفیگ

async function createConfig(
  label,
  gb,
  days,
  ipLimit
){

  try{

    const {data}=await client.post(
      "/api/bot/configs",
      {
        label:String(label),
        gb:Number(gb),
        days:Number(days),
        ip_limit:Number(ipLimit)
      }
    );


    console.log(
      "X4G CONFIG:",
      data
    );


    return data;


  }catch(err){

    console.log(
      "CREATE CONFIG ERROR:",
      err.response?.data || err.message
    );

    throw err;

  }

}



// گرفتن وضعیت

async function getConfigStatus(uuid){

  try{

    const {data}=await client.get(
      `/api/bot/configs/${uuid}`
    );


    return data;


  }catch(err){

    console.log(
      "STATUS ERROR:",
      err.response?.data || err.message
    );

    throw err;

  }

}



// تمدید

async function renewConfig(
 uuid,
 gb,
 days
){

 const {data}=await client.post(

  `/api/bot/configs/${uuid}/renew`,

  {
    gb:Number(gb),
    days:Number(days),
    reset_usage:true
  }

 );

 return data;

}



// خاموش کردن

async function disableConfig(uuid){

 const {data}=await client.post(

  `/api/bot/configs/${uuid}/disable`

 );

 return data;

}



// ساخت سرویس کامل

async function createFullService(
 name,
 gb,
 days,
 ipLimit
){

 const cfg = await createConfig(
  name,
  gb,
  days,
  ipLimit
 );


 return {

   uuid: cfg.uuid,

   vless_link:
    cfg.vless_link || null,


   sub_url:
    cfg.sub_url || null

 };

}



module.exports={

 createConfig,

 createFullService,

 getConfigStatus,

 renewConfig,

 disableConfig

};