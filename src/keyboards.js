const { Markup } = require("telegraf");
const config = require("./config");


// منوی اصلی کاربر
function mainMenu() {
  return Markup.keyboard([
    ["🛒 خرید سرویس جدید"],
    ["📦 سرویس‌های من"]
  ]).resize();
}


// منوی ادمین
function adminMenu() {
  return Markup.keyboard([
    ["🛒 خرید سرویس جدید", "📦 سرویس‌های من"],
    ["🛠 پنل ادمین"]
  ]).resize();
}


// لیست پلن‌ها
function plansKeyboard(plans, prefix = "plan") {

  const rows = plans.map((p) => {

    const text = p.price
      ? `${p.name} — ${p.price.toLocaleString("fa-IR")} تومان`
      : p.name;


    return [
      Markup.button.callback(
        text,
        `${prefix}:${p.id}`
      )
    ];

  });


  return Markup.inlineKeyboard(rows);
}



// دکمه انصراف
function cancelKeyboard() {

  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        "❌ انصراف",
        "cancel"
      )
    ]
  ]);

}



// بررسی رسید توسط ادمین
function receiptReviewKeyboard(orderId) {

  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        "✅ تایید",
        `approve:${orderId}`
      ),

      Markup.button.callback(
        "❌ رد",
        `reject:${orderId}`
      )
    ]
  ]);

}



// لیست سرویس‌ها
function ordersKeyboard(orders) {

  const rows = orders.map((o)=>[

    Markup.button.callback(
      `📄 ${o.custom_name || `سرویس #${o.id}`}`,
      `order:${o.id}`
    )

  ]);


  return Markup.inlineKeyboard(rows);

}




// عملیات روی سرویس
function orderActionsKeyboard(
  orderId,
  uid,
  configText
){

  const rows = [];


  // کپی کانفیگ
  if(configText){

    rows.push([

      Markup.button.switchToCurrentChat(
        "📋 کپی کانفیگ",
        configText
      )

    ]);

  }



  // وضعیت سرویس
  if(config.PUBLIC_BASE_URL){

    const webAppUrl =
      `${config.PUBLIC_BASE_URL}/status?uid=${uid}`;


    rows.push([

      Markup.button.webApp(
        "📊 وضعیت سرویس",
        webAppUrl
      )

    ]);

  } else {


    rows.push([

      Markup.button.callback(
        "📊 وضعیت سرویس",
        `status:${uid}`
      )

    ]);

  }



  // تمدید
  rows.push([

    Markup.button.callback(
      "🔄 تمدید این سرویس",
      `renew:${orderId}`
    )

  ]);



  return Markup.inlineKeyboard(rows);

}



module.exports = {

  mainMenu,

  adminMenu,

  plansKeyboard,

  cancelKeyboard,

  receiptReviewKeyboard,

  ordersKeyboard,

  orderActionsKeyboard

};