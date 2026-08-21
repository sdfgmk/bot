const { Telegraf } = require("telegraf");
const config = require("./config");
const db = require("./db");
const x4g = require("./x4gClient");
const kb = require("./keyboards");

const bot = new Telegraf(config.BOT_TOKEN);

// ── FSM ساده‌ی درون‌حافظه‌ای (کافیه برای این حجم پروژه) ─────────────────────
// key: telegram_id -> { step, data }
const state = new Map();
function setState(id, step, data = {}) {
  state.set(id, { step, data });
}
function getState(id) {
  return state.get(id) || { step: null, data: {} };
}
function clearState(id) {
  state.delete(id);
}

// ── /start ───────────────────────────────────────────────────────────────
bot.start(async (ctx) => {
  clearState(ctx.from.id);
  db.ensureUser(ctx.from.id, ctx.from.username, [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(" "));
  const menu = db.isAdmin(ctx.from.id) ? kb.adminMenu() : kb.mainMenu();
  await ctx.reply("سلام 👋\nبه ربات فروش سرویس خوش اومدی.\nاز منوی پایین انتخاب کن:", menu);
});

// ── خرید سرویس جدید ──────────────────────────────────────────────────────
bot.hears("🛒 خرید سرویس جدید", async (ctx) => {
  const plans = db.listPlans();
  if (!plans.length) return ctx.reply("فعلاً هیچ پلنی تعریف نشده. بعداً امتحان کن.");
  await ctx.reply("یکی از پلن‌ها رو انتخاب کن:", kb.plansKeyboard(plans));
});

bot.action(/^plan:(\d+)$/, async (ctx) => {
  const planId = Number(ctx.match[1]);
  const plan = db.getPlan(planId);
  if (!plan) return ctx.answerCbQuery("این پلن یافت نشد.", { show_alert: true });
  setState(ctx.from.id, "buy_entering_name", { planId });
  await ctx.editMessageText(`پلن انتخابی: ${plan.name}\n\nحالا یه اسم دلخواه برای این سرویس بفرست (مثلاً اسم خودت):`);
  await ctx.answerCbQuery();
});

// ── سرویس‌های من ──────────────────────────────────────────────────────────
bot.hears("📦 سرویس‌های من", async (ctx) => {
  const orders = db.listUserActiveOrders(ctx.from.id);
  if (!orders.length) return ctx.reply("هنوز سرویس فعالی نداری. از منوی «خرید سرویس جدید» شروع کن.");
  await ctx.reply("سرویس‌های فعال تو:", kb.ordersKeyboard(orders));
});

bot.action(/^order:(\d+)$/, async (ctx) => {
  const orderId = Number(ctx.match[1]);
  const order = db.getOrder(orderId);
  if (!order || order.telegram_id !== ctx.from.id) {
    return ctx.answerCbQuery("این سرویس متعلق به تو نیست.", { show_alert: true });
  }
  if (!order.x4g_uuid) return ctx.answerCbQuery("این سرویس هنوز کانفیگ نداره.", { show_alert: true });
  await ctx.reply(
    `سرویس: ${order.custom_name}\nبرای دیدن جزئیات مصرف روی دکمه‌ی زیر بزن 👇`,
    kb.orderActionsKeyboard(orderId, order.x4g_uuid)
  );
  await ctx.answerCbQuery();
});

// ── تمدید ────────────────────────────────────────────────────────────────
bot.action(/^renew:(\d+)$/, async (ctx) => {
  const orderId = Number(ctx.match[1]);
  const order = db.getOrder(orderId);
  if (!order || order.telegram_id !== ctx.from.id) {
    return ctx.answerCbQuery("این سرویس متعلق به تو نیست.", { show_alert: true });
  }
  const plans = db.listPlans();
  setState(ctx.from.id, "renew_choosing_plan", { renewOrderId: orderId });
  await ctx.reply("یه پلن برای تمدید انتخاب کن:", kb.plansKeyboard(plans, "renewplan"));
  await ctx.answerCbQuery();
});

bot.action(/^renewplan:(\d+)$/, async (ctx) => {
  const st = getState(ctx.from.id);
  if (st.step !== "renew_choosing_plan") return ctx.answerCbQuery();
  const planId = Number(ctx.match[1]);
  const plan = db.getPlan(planId);
  const oldOrder = db.getOrder(st.data.renewOrderId);
  const newOrderId = db.createOrder(ctx.from.id, planId, oldOrder.custom_name, true, oldOrder.id);
  setState(ctx.from.id, "renew_waiting_receipt", { orderId: newOrderId });

  const priceText = plan.price ? `${plan.price.toLocaleString("fa-IR")} تومان` : "طبق توافق";
  await ctx.editMessageText(
    `تمدید سرویس «${oldOrder.custom_name}» با پلن ${plan.name}\n\n` +
      `مبلغ: ${priceText}\nشماره کارت: ${config.CARD_NUMBER}\nبه نام: ${config.CARD_OWNER}\n\n` +
      `بعد از واریز، رسید رو بفرست.`
  );
  await ctx.answerCbQuery();
});

bot.action("cancel", async (ctx) => {
  clearState(ctx.from.id);
  await ctx.editMessageText("لغو شد.");
  await ctx.answerCbQuery();
});

// ── دریافت اسم دلخواه سرویس ──────────────────────────────────────────────
bot.on("text", async (ctx, next) => {
  const st = getState(ctx.from.id);

  if (st.step === "buy_entering_name") {
    const customName = (ctx.message.text || "").trim().slice(0, 40);
    if (!customName) return ctx.reply("لطفاً یه اسم معتبر بفرست.");
    const plan = db.getPlan(st.data.planId);
    const orderId = db.createOrder(ctx.from.id, plan.id, customName);
    setState(ctx.from.id, "buy_waiting_receipt", { orderId });

    const priceText = plan.price ? `${plan.price.toLocaleString("fa-IR")} تومان` : "طبق توافق";
    return ctx.reply(
      `✅ سفارش ثبت شد.\n\n` +
        `مبلغ قابل پرداخت: ${priceText}\n` +
        `شماره کارت: ${config.CARD_NUMBER}\n` +
        `به نام: ${config.CARD_OWNER}\n\n` +
        `بعد از واریز، عکس رسید یا کد پیگیری رو همینجا بفرست.`,
      kb.cancelKeyboard()
    );
  }

  if (st.step === "buy_waiting_receipt" || st.step === "renew_waiting_receipt") {
    return handleReceipt(ctx, st, null, ctx.message.text.trim().slice(0, 300));
  }

  if (st.step === "admin_newplan") {
    return handleNewPlanInput(ctx);
  }

  return next();
});

bot.on("photo", async (ctx, next) => {
  const st = getState(ctx.from.id);
  if (st.step === "buy_waiting_receipt" || st.step === "renew_waiting_receipt") {
    const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
    return handleReceipt(ctx, st, fileId, null);
  }
  return next();
});

async function handleReceipt(ctx, st, fileId, text) {
  db.attachReceipt(st.data.orderId, fileId, text);
  clearState(ctx.from.id);
  await notifyAdminsNewReceipt(st.data.orderId);
  const menu = db.isAdmin(ctx.from.id) ? kb.adminMenu() : kb.mainMenu();
  await ctx.reply("رسید دریافت شد ✅ منتظر تایید ادمین باش، به‌محض تایید پیام میدیم.", menu);
}

async function notifyAdminsNewReceipt(orderId) {
  const order = db.getOrder(orderId);
  const plan = order.plan_id ? db.getPlan(order.plan_id) : null;
  const text =
    `🧾 سفارش جدید #${orderId}\n` +
    `کاربر: ${order.telegram_id}\n` +
    `نام سرویس: ${order.custom_name}\n` +
    `پلن: ${plan ? plan.name : "—"}\n` +
    (order.receipt_text ? `رسید متنی: ${order.receipt_text}` : "");

  for (const adminId of db.allAdminIds()) {
    try {
      if (order.receipt_file_id) {
        await bot.telegram.sendPhoto(adminId, order.receipt_file_id, {
          caption: text,
          ...kb.receiptReviewKeyboard(orderId),
        });
      } else {
        await bot.telegram.sendMessage(adminId, text, kb.receiptReviewKeyboard(orderId));
      }
    } catch (e) {
      // اگه ادمین ربات رو بلاک کرده باشه یا استارت نزده باشه
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════
// بخش ادمین
// ══════════════════════════════════════════════════════════════════════════

bot.hears("🛠 پنل ادمین", async (ctx) => {
  if (!db.isAdmin(ctx.from.id)) return;
  const plans = await db.listPlans();
  const pending = await db.listPendingOrders();
  await ctx.reply(
    `🛠 پنل ادمین\n\nپلن‌های فعال: ${plans.length}\nسفارش‌های در انتظار بررسی: ${pending.length}\n\n` +
      `دستورات:\n/newplan برای ساخت پلن جدید\n/plans برای دیدن لیست پلن‌ها\n/pending برای دیدن سفارش‌های در انتظار`
  );
});

bot.command("plans", async (ctx) => {
  if (!db.isAdmin(ctx.from.id)) return;
  const plans = await db.listPlans(false);
  if (!plans.length) return ctx.reply("هیچ پلنی نیست.");
  const lines = plans.map(
    (p) => `#${p.id} — ${p.name} — ${p.gb}GB / ${p.days}روز / ${p.ip_limit}کاربر — ${p.price.toLocaleString("fa-IR")} تومان`
  );
  await ctx.reply(lines.join("\n"));
});

bot.command("newplan", async (ctx) => {
  if (!db.isAdmin(ctx.from.id)) return;
  setState(ctx.from.id, "admin_newplan_step", {step:1});
  await ctx.reply("🏷 نام پلن را بفرست:");
});

async function handleNewPlanInput(ctx) {
  const st = getState(ctx.from.id);
  const v = ctx.message.text.trim();
  const data = st.data || {};
  if (st.step !== "admin_newplan_step") return;

  if (data.step === 1) { setState(ctx.from.id,"admin_newplan_step",{step:2,name:v}); return ctx.reply("📦 چند گیگ؟"); }
  if (data.step === 2) { setState(ctx.from.id,"admin_newplan_step",{...data,step:3,gb:Number(v)}); return ctx.reply("📅 چند روز؟"); }
  if (data.step === 3) { setState(ctx.from.id,"admin_newplan_step",{...data,step:4,days:Number(v)}); return ctx.reply("👥 چند کاربر؟"); }
  if (data.step === 4) { setState(ctx.from.id,"admin_newplan_step",{...data,step:5,ipLimit:Number(v)}); return ctx.reply("💰 قیمت؟"); }
  if (data.step === 5) {
    await db.addPlan(data.name,data.gb,data.days,data.ipLimit,Number(v));
    clearState(ctx.from.id);
    return ctx.reply(`✅ پلن ${data.name} ساخته شد.`);
  }
}


bot.command("delplan", async (ctx) => {
  if (!db.isAdmin(ctx.from.id)) return;
  await db.hardDeletePlan(Number(ctx.message.text.split(" ")[1]));
  ctx.reply("🗑 پلن کامل حذف شد.");
});

bot.command("toggleplan", async (ctx) => {
  if (!db.isAdmin(ctx.from.id)) return;
  await db.togglePlan(Number(ctx.message.text.split(" ")[1]));
  ctx.reply("👁 وضعیت پلن تغییر کرد.");
});

bot.command("pending", async (ctx) => {
  if (!db.isAdmin(ctx.from.id)) return;
  const orders = db.listPendingOrders();
  if (!orders.length) return ctx.reply("سفارش در انتظاری نیست.");
  for (const o of orders) {
    await ctx.reply(`سفارش #${o.id} — کاربر ${o.telegram_id} — ${o.custom_name}`, kb.receiptReviewKeyboard(o.id));
  }
});

bot.action(/^approve:(\d+)$/, async (ctx) => {
  if (!db.isAdmin(ctx.from.id)) return ctx.answerCbQuery("فقط ادمین.", { show_alert: true });
  const orderId = Number(ctx.match[1]);
  const order = db.getOrder(orderId);
  if (!order) return ctx.answerCbQuery("پیدا نشد.", { show_alert: true });
  const plan = order.plan_id ? db.getPlan(order.plan_id) : null;
  if (!plan) return ctx.answerCbQuery("پلن این سفارش پیدا نشد.", { show_alert: true });

  let result, uid;
  try {
    if (order.is_renewal && order.renew_of_order_id) {
      const oldOrder = db.getOrder(order.renew_of_order_id);
      result = await x4g.renewConfig(oldOrder.x4g_uuid, plan.gb, plan.days, true);
      uid = oldOrder.x4g_uuid;
      db.setOrderStatus(order.renew_of_order_id, "expired");
    } else {
      result = await x4g.createConfig(order.custom_name, plan.gb, plan.days, plan.ip_limit);
      uid = result.uuid;
    }
    db.setOrderStatus(orderId, "active", uid);
  } catch (e) {
    await ctx.answerCbQuery("خطا در اتصال به پنل X4G.", { show_alert: true });
    await ctx.reply(`⚠️ خطا هنگام ساخت/تمدید کانفیگ برای سفارش #${orderId}: ${e.message}`);
    return;
  }

  try {
    if (ctx.callbackQuery.message.caption !== undefined) {
      await ctx.editMessageCaption(`✅ سفارش #${orderId} تایید شد.`);
    } else {
      await ctx.editMessageText(`✅ سفارش #${orderId} تایید شد.`);
    }
  } catch (e) {}
  await ctx.answerCbQuery("تایید شد.");

  try {
    await bot.telegram.sendMessage(
      order.telegram_id,
      `🎉 سرویس «${order.custom_name}» فعال شد!\n\nلینک کانفیگ:\n${result.vless_link || ""}\n\n` +
        `از منوی «📦 سرویس‌های من» می‌تونی وضعیت مصرف رو ببینی.`
    );
  } catch (e) {}
});

bot.action(/^reject:(\d+)$/, async (ctx) => {
  if (!db.isAdmin(ctx.from.id)) return ctx.answerCbQuery("فقط ادمین.", { show_alert: true });
  const orderId = Number(ctx.match[1]);
  const order = db.getOrder(orderId);
  if (!order) return ctx.answerCbQuery("پیدا نشد.", { show_alert: true });
  db.setOrderStatus(orderId, "rejected");
  try {
    if (ctx.callbackQuery.message.caption !== undefined) {
      await ctx.editMessageCaption(`❌ سفارش #${orderId} رد شد.`);
    } else {
      await ctx.editMessageText(`❌ سفارش #${orderId} رد شد.`);
    }
  } catch (e) {}
  await ctx.answerCbQuery("رد شد.");
  try {
    await bot.telegram.sendMessage(
      order.telegram_id,
      `❌ متاسفانه رسید سفارش «${order.custom_name}» تایید نشد. با پشتیبانی در ارتباط باش.`
    );
  } catch (e) {}
});

module.exports = bot;
