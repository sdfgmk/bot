const axios = require("axios");
const config = require("./config");


// اتصال به API پنل X4G

const client = axios.create({

  baseURL: config.X4G_BASE_URL,

  timeout: 20000,

  headers: {

    "X-API-Key": config.X4G_BOT_API_KEY,

    "Content-Type": "application/json"

  }

});




// ساخت کانفیگ جدید

async function createConfig(
  label,
  gb,
  days,
  ipLimit
){

  try {

    const { data } = await client.post(
      "/api/bot/configs",
      {
        label,
        gb: Number(gb),
        days: Number(days),
        ip_limit: Number(ipLimit)
      }
    );


    return data;


  } catch(err){

    console.log(
      "X4G CREATE ERROR:",
      err.response?.data || err.message
    );

    throw err;

  }

}





// دریافت وضعیت سرویس

async function getConfigStatus(uid){

  try {


    const { data } = await client.get(
      `/api/bot/configs/${uid}`
    );


    return data;


  } catch(err){


    console.log(
      "X4G STATUS ERROR:",
      err.response?.data || err.message
    );


    throw err;

  }

}





// تمدید سرویس

async function renewConfig(
  uid,
  gb,
  days,
  resetUsage = true
){

  try {


    const { data } = await client.post(
      `/api/bot/configs/${uid}/renew`,
      {

        gb: Number(gb),

        days: Number(days),

        reset_usage: resetUsage

      }
    );


    return data;


  } catch(err){


    console.log(
      "X4G RENEW ERROR:",
      err.response?.data || err.message
    );


    throw err;

  }

}





// خاموش کردن سرویس

async function disableConfig(uid){

  try {


    const { data } = await client.post(
      `/api/bot/configs/${uid}/disable`
    );


    return data;


  } catch(err){


    console.log(
      "X4G DISABLE ERROR:",
      err.response?.data || err.message
    );


    throw err;

  }

}





module.exports = {

  createConfig,

  getConfigStatus,

  renewConfig,

  disableConfig

};