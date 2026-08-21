const { Markup } = require("telegraf");
const config = require("./config");

function mainMenu() {
  return Markup.keyboard([["🛒 خرید سرویس جدید"], ["📦 سرویس‌های من"]]).resize();
}

function adminMenu() {
  return Markup.keyboard([
    ["🛒 خرید سرویس جدید", "📦 سرویس‌های من"],
    ["🛠 پنل ادمین"],
  ]).resize();
}

function plansKeyboard(plans, prefix = "plan") {
  const rows = plans.map((p) => {
    const text = p.price ? `${p.name} — ${p.price.toLocaleString("fa-IR")} تومان` : p.name;
    return [Markup.button.callback(text, `${prefix}:${p.id}`)];
  });
  return Markup.inlineKeyboard(rows);
}

function cancelKeyboard() {
  return Markup.inlineKeyboard([[Markup.button.callback("❌ انصراف", "cancel")]]);
}

function receiptReviewKeyboard(orderId) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("✅ تایید", `approve:${orderId}`),
      Markup.button.callback("❌ رد", `reject:${orderId}`),
    ],
  ]);
}

function ordersKeyboard(orders) {
  const rows = orders.map((o) => [
    Markup.button.callback(`📄 ${o.custom_name || `سرویس #${o.id}`}`, `order:${o.id}`),
  ]);
  return Markup.inlineKeyboard(rows);
}

function orderActionsKeyboard(orderId, uid) {
  const rows = [];
  if (config.PUBLIC_BASE_URL) {
    const webAppUrl = `${config.PUBLIC_BASE_URL}/status?uid=${uid}`;
    rows.push([Markup.button.webApp("📊 وضعیت سرویس", webAppUrl)]);
  }
  rows.push([Markup.button.callback("🔄 تمدید این سرویس", `renew:${orderId}`)]);
  return Markup.inlineKeyboard(rows);
}

module.exports = {
  mainMenu,
  adminMenu,
  plansKeyboard,
  cancelKeyboard,
  receiptReviewKeyboard,
  ordersKeyboard,
  orderActionsKeyboard,
};
