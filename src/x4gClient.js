const axios = require("axios");
const config = require("./config");


const client = axios.create({

  baseURL: config.X4G_BASE_URL,

  timeout:20000,

  headers:{
    "X-API-Key":config.X4G_BOT_API_KEY,
    "Content-Type":"application/json"
  }

});



// ساخت کانفیگ
async function createConfig(label, gb, days, ipLimit){

 const {data}=await client.post(
  "/api/bot/configs",
  {
   label,
   gb:Number(gb),
   days:Number(days),
   ip_limit:Number(ipLimit)
  }
 );

 return data;

}



// ساخت گروه ساب
async function createSub(name){

 const {data}=await client.post(
  "/api/subs",
  {
   name
  }
 );

 return data;

}



// اضافه کردن کانفیگ به گروه
async function addConfigToSub(subId, linkId){

 const {data}=await client.post(
  `/api/subs/${subId}/links`,
  {
   link_id: linkId,
   action:"add"
  }
 );

 return data;

}



// ساخت کامل سرویس
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


 const sub = await createSub(name);


 await addConfigToSub(
  sub.sub_id || sub.id,
  cfg.uuid
 );


 return {

  ...cfg,

  sub_url:
   `${config.X4G_BASE_URL}/p/${sub.uuid_key}`

 };

}



async function getConfigStatus(uid){

 const {data}=await client.get(
  `/api/bot/configs/${uid}`
 );

 return data;

}



async function renewConfig(uid,gb,days){

 const {data}=await client.post(
  `/api/bot/configs/${uid}/renew`,
  {
   gb:Number(gb),
   days:Number(days),
   reset_usage:true
  }
 );

 return data;

}



async function disableConfig(uid){

 const {data}=await client.post(
  `/api/bot/configs/${uid}/disable`
 );

 return data;

}



module.exports={
 createConfig,
 createSub,
 addConfigToSub,
 createFullService,
 getConfigStatus,
 renewConfig,
 disableConfig
};