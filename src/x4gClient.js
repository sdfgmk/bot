const axios = require("axios");
const config = require("./config");


const client = axios.create({

  baseURL: config.X4G_BASE_URL,

  timeout:20000,

  headers:{
    "X-API-Key": config.X4G_BOT_API_KEY,
    "Content-Type":"application/json"
  }

});



// =========================
// ساخت کانفیگ
// =========================

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
    label,
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



// =========================
// ساخت گروه ساب
// =========================

async function createSub(name){

 try{

  const {data}=await client.post(
   "/api/subs",
   {
    name
   }
  );


  console.log(
   "X4G SUB:",
   data
  );


  return data;


 }catch(err){

  console.log(
   "CREATE SUB ERROR:",
   err.response?.data || err.message
  );

  throw err;

 }

}



// =========================
// اتصال کانفیگ به ساب
// =========================

async function addConfigToSub(
 subId,
 uuid
){

 try{

  const {data}=await client.post(

   `/api/subs/${subId}/links`,

   {
    uuid
   }

  );


  console.log(
   "SUB LINK RESULT:",
   data
  );


  return data;


 }catch(err){

  console.log(
   "ADD SUB LINK ERROR:",
   err.response?.data || err.message
  );

  throw err;

 }

}



// =========================
// ساخت کامل سرویس
// =========================

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


 const sub = await createSub(
  name
 );


 await addConfigToSub(
  sub.id || sub.sub_id,
  cfg.uuid
 );


 return {

  ...cfg,

  sub_id:
   sub.id || sub.sub_id,


  sub_url:
   sub.url ||
   sub.public_url ||
   (
    sub.key
     ? `${config.X4G_BASE_URL}/p/${sub.key}`
     : null
   )

 };

}



// =========================
// وضعیت
// =========================

async function getConfigStatus(uid){

 const {data}=await client.get(
  `/api/bot/configs/${uid}`
 );

 return data;

}



// =========================
// تمدید
// =========================

async function renewConfig(
 uid,
 gb,
 days
){

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



// =========================
// خاموش
// =========================

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