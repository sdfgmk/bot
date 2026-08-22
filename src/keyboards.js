const { Markup } = require("telegraf");
const config = require("./config");


// ===============================
// منوی اصلی کاربر
// ===============================
function mainMenu() {

  return Markup.keyboard([
    ["🛒 خرید سرویس جدید"],
    ["📦 سرویس‌های من"]
  ])
  .resize();

}



// ===============================
// منوی ادمین
// ===============================
function adminMenu() {

  return Markup.keyboard([
    [
      "🛒 خرید سرویس جدید",
      "📦 سرویس‌های من"
    ],
    [
      "🛠 پنل ادمین"
    ]
  ])
  .resize();

}



// ===============================
// لیست پلن‌ها
// ===============================
function plansKeyboard(
  plans,
  prefix="plan"
){

  const rows = plans.map(plan=>{

    const text =
      plan.price
      ? `${plan.name} — ${plan.price.toLocaleString("fa-IR")} تومان`
      : plan.name;


    return [
      Markup.button.callback(
        text,
        `${prefix}:${plan.id}`
      )
    ];

  });


  return Markup.inlineKeyboard(rows);

}



// ===============================
// لغو
// ===============================
function cancelKeyboard(){

  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        "❌ انصراف",
        "cancel"
      )
    ]
  ]);

}



// ===============================
// تایید رسید ادمین
// ===============================
function receiptReviewKeyboard(orderId){

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



// ===============================
// لیست سرویس‌های کاربر
// ===============================
function ordersKeyboard(orders){

  const rows = orders.map(order=>{

    return [
      Markup.button.callback(
        `📄 ${order.custom_name || `سرویس #${order.id}`}`,
        `order:${order.id}`
      )
    ];

  });


  return Markup.inlineKeyboard(rows);

}



// ===============================
// دکمه‌های داخل سرویس
// ===============================
function orderActionsKeyboard(
  orderId,
  uid,
  configText=null
){

  const rows=[];



  // کپی کانفیگ
  rows.push([
    Markup.button.callback(
      "📋 دریافت کانفیگ",
      `copy:${orderId}`
    )
  ]);



  // وضعیت سرویس

  if(config.PUBLIC_BASE_URL){

    rows.push([
      Markup.button.webApp(
        "📊 وضعیت سرویس",
        `${config.PUBLIC_BASE_URL}/status?uid=${uid}`
      )
    ]);

  }
  else{

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



module.exports={

  mainMenu,

  adminMenu,

  plansKeyboard,

  cancelKeyboard,

  receiptReviewKeyboard,

  ordersKeyboard,

  orderActionsKeyboard

};