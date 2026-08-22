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
  await db.ensureUser(ctx.from.id, ctx.from.username, [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(" "));
 const isAdmin = await db.isAdmin(ctx.from.id);
const menu = isAdmin ? kb.adminMenu() : kb.mainMenu();
  await ctx.reply("سلام 👋\nبه ربات فروش سرویس خوش اومدی.\nاز منوی پایین انتخاب کن:", menu);
});

// ── خرید سرویس جدید ──────────────────────────────────────────────────────

bot.hears("🛒 خرید سرویس جدید", async (ctx) => {
  try {
    const plans = await db.listPlans();

    console.log("PLANS:", plans);

    if (!plans.length) {
      return ctx.reply("فعلاً هیچ پلنی تعریف نشده. بعداً امتحان کن.");
    }

    await ctx.reply(
      "یکی از پلن‌ها رو انتخاب کن:",
      kb.plansKeyboard(plans)
    );

  } catch (err) {
    console.log("BUY PLAN ERROR:", err);
    await ctx.reply("❌ خطا در دریافت پلن‌ها.");
  }
});


bot.action(/^plan:(\d+)$/, async (ctx) => {
  try {
    const planId = Number(ctx.match[1]);

    const plan = await db.getPlan(planId);

    if (!plan) {
      return ctx.answerCbQuery(
        "این پلن یافت نشد.",
        { show_alert: true }
      );
    }

    setState(
      ctx.from.id,
      "buy_entering_name",
      { planId }
    );

    await ctx.editMessageText(
      `پلن انتخابی: ${plan.name}\n\n` +
      `حالا یه اسم دلخواه برای این سرویس بفرست ` +
      `(مثلاً اسم خودت):`
    );

    await ctx.answerCbQuery();

  } catch (err) {
    console.log("PLAN SELECT ERROR:", err);
    await ctx.answerCbQuery(
      "خطا در انتخاب پلن.",
      { show_alert: true }
    );
  }
});

// ── سرویس‌های من ──────────────────────────────────────────────────────────
bot.hears("📦 سرویس‌های من", async (ctx) => {
  const orders = await db.listUserActiveOrders(ctx.from.id);

  if (!orders.length)
    return ctx.reply("هنوز سرویس فعالی نداری. از منوی «خرید سرویس جدید» شروع کن.");

  await ctx.reply("سرویس‌های فعال تو:", kb.ordersKeyboard(orders));
});

bot.action(/^order:(\d+)$/, async (ctx) => {
  const orderId = Number(ctx.match[1]);

  const order = await db.getOrder(orderId);

  if (!order || order.telegram_id !== ctx.from.id) {
    return ctx.answerCbQuery("این سرویس متعلق به تو نیست.", { show_alert: true });
  }

  if (!order.x4g_uuid)
    return ctx.answerCbQuery("این سرویس هنوز کانفیگ نداره.", { show_alert: true });

  await ctx.reply(
    `سرویس: ${order.custom_name}\nبرای دیدن جزئیات مصرف روی دکمه‌ی زیر بزن 👇`,
    kb.orderActionsKeyboard(orderId, order.x4g_uuid)
  );

  await ctx.answerCbQuery();
});

// ── تمدید ────────────────────────────────────────────────────────────────
bot.action(/^renew:(\d+)$/, async (ctx) => {
  const orderId = Number(ctx.match[1]);

  const order = await db.getOrder(orderId);

  if (!order || order.telegram_id !== ctx.from.id) {
    return ctx.answerCbQuery("این سرویس متعلق به تو نیست.", { show_alert: true });
  }

  const plans = await db.listPlans();

  setState(ctx.from.id, "renew_choosing_plan", {
    renewOrderId: orderId
  });

  await ctx.reply(
    "یه پلن برای تمدید انتخاب کن:",
    kb.plansKeyboard(plans, "renewplan")
  );

  await ctx.answerCbQuery();
});


bot.action(/^renewplan:(\d+)$/, async (ctx) => {
  const st = getState(ctx.from.id);

  if (st.step !== "renew_choosing_plan") {
    return ctx.answerCbQuery();
  }

  const planId = Number(ctx.match[1]);

  const plan = await db.getPlan(planId);

  if (!plan) {
    return ctx.answerCbQuery("پلن پیدا نشد.", {
      show_alert: true
    });
  }

  const oldOrder = await db.getOrder(st.data.renewOrderId);

  if (!oldOrder) {
    return ctx.answerCbQuery("سرویس قبلی پیدا نشد.", {
      show_alert: true
    });
  }

  const newOrderId = await db.createOrder(
    ctx.from.id,
    planId,
    oldOrder.custom_name,
    true,
    oldOrder.id
  );

  setState(ctx.from.id, "renew_waiting_receipt", {
    orderId: newOrderId
  });


  const priceText = plan.price
    ? `${plan.price.toLocaleString("fa-IR")} تومان`
    : "طبق توافق";


  await ctx.editMessageText(
    `تمدید سرویس «${oldOrder.custom_name}» با پلن ${plan.name}\n\n` +
    `مبلغ: ${priceText}\n` +
    `شماره کارت: ${config.CARD_NUMBER}\n` +
    `به نام: ${config.CARD_OWNER}\n\n` +
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

    if (!customName) {
      return ctx.reply("لطفاً یه اسم معتبر بفرست.");
    }

    const plan = await db.getPlan(st.data.planId);

    if (!plan) {
      clearState(ctx.from.id);
      return ctx.reply("❌ این پلن دیگر وجود ندارد.");
    }

    const orderId = await db.createOrder(
      ctx.from.id,
      plan.id,
      customName
    );

    setState(ctx.from.id, "buy_waiting_receipt", {
      orderId
    });

    const priceText = plan.price
      ? `${plan.price.toLocaleString("fa-IR")} تومان`
      : "طبق توافق";

    return ctx.reply(
      `✅ سفارش ثبت شد.\n\n` +
      `📦 پلن: ${plan.name}\n` +
      `💰 مبلغ قابل پرداخت: ${priceText}\n` +
      `💳 شماره کارت: ${config.CARD_NUMBER}\n` +
      `👤 به نام: ${config.CARD_OWNER}\n\n` +
      `بعد از واریز، عکس رسید یا کد پیگیری رو همینجا بفرست.`,
      kb.cancelKeyboard()
    );
  }


  if (
    st.step === "buy_waiting_receipt" ||
    st.step === "renew_waiting_receipt"
  ) {
    return handleReceipt(
      ctx,
      st,
      null,
      ctx.message.text.trim().slice(0, 300)
    );
  }


  if (st.step === "admin_newplan_step") {
    return handleNewPlanInput(ctx);
  }


  return next();
});


bot.on("photo", async (ctx, next) => {

  const st = getState(ctx.from.id);

  if (
    st.step === "buy_waiting_receipt" ||
    st.step === "renew_waiting_receipt"
  ) {

    const fileId =
      ctx.message.photo[
        ctx.message.photo.length - 1
      ].file_id;

    return handleReceipt(
      ctx,
      st,
      fileId,
      null
    );
  }

  return next();
});


async function handleReceipt(ctx, st, fileId, text) {

  await db.attachReceipt(
    st.data.orderId,
    fileId,
    text
  );

  clearState(ctx.from.id);

  await notifyAdminsNewReceipt(
    st.data.orderId
  );

  const isAdmin =
    await db.isAdmin(ctx.from.id);

  const menu = isAdmin
    ? kb.adminMenu()
    : kb.mainMenu();


  await ctx.reply(
    "رسید دریافت شد ✅\nمنتظر تایید ادمین باش، به‌محض تایید پیام میدیم.",
    menu
  );
}



async function notifyAdminsNewReceipt(orderId) {

  const order =
    await db.getOrder(orderId);


  if (!order) return;


  const plan =
    order.plan_id
      ? await db.getPlan(order.plan_id)
      : null;


  const text =
    `🧾 سفارش جدید #${orderId}\n` +
    `👤 کاربر: ${order.telegram_id}\n` +
    `📌 نام سرویس: ${order.custom_name}\n` +
    `📦 پلن: ${plan ? plan.name : "—"}\n` +
    (
      order.receipt_text
        ? `📝 رسید متنی: ${order.receipt_text}`
        : ""
    );


  const admins =
    await db.allAdminIds();


  for (const adminId of admins) {

    try {

      if (order.receipt_file_id) {

        await bot.telegram.sendPhoto(
          adminId,
          order.receipt_file_id,
          {
            caption: text,
            ...kb.receiptReviewKeyboard(orderId)
          }
        );

      } else {

        await bot.telegram.sendMessage(
          adminId,
          text,
          kb.receiptReviewKeyboard(orderId)
        );

      }

    } catch (e) {

      console.log(
        "ارسال به ادمین خطا:",
        adminId
      );

    }

  }

}

// ══════════════════════════════════════════════════════════════════════════
// بخش ادمین
// ══════════════════════════════════════════════════════════════════════════

bot.hears("🛠 پنل ادمین", async (ctx) => {
  if (!await db.isAdmin(ctx.from.id)) return;

  const plans = await db.listPlans();
  const pending = await db.listPendingOrders();

  await ctx.reply(
    `🛠 پنل ادمین\n\n` +
    `پلن‌های فعال: ${plans.length}\n` +
    `سفارش‌های در انتظار بررسی: ${pending.length}\n\n` +
    `دستورات:\n` +
    `/newplan ساخت پلن جدید\n` +
    `/plans لیست پلن‌ها\n` +
    `/pending سفارش‌های در انتظار`
  );
});


bot.command("plans", async (ctx) => {
  if (!await db.isAdmin(ctx.from.id)) return;

  const plans = await db.listPlans(false);

  if (!plans.length)
    return ctx.reply("هیچ پلنی نیست.");

  const lines = plans.map(
    p =>
      `#${p.id} — ${p.name}\n` +
      `📦 ${p.gb}GB | 📅 ${p.days} روز | 👥 ${p.ip_limit} کاربر\n` +
      `💰 ${p.price.toLocaleString("fa-IR")} تومان`
  );

  await ctx.reply(lines.join("\n\n"));
});


bot.command("newplan", async (ctx) => {
  if (!await db.isAdmin(ctx.from.id)) return;

  setState(ctx.from.id, "admin_newplan_step", { step: 1 });

  await ctx.reply("🏷 نام پلن را بفرست:");
});


async function handleNewPlanInput(ctx) {

  const st = getState(ctx.from.id);

  if (st.step !== "admin_newplan_step")
    return;

  const v = ctx.message.text.trim();
  const data = st.data || {};


  if (data.step === 1) {
    setState(ctx.from.id, "admin_newplan_step", {
      step:2,
      name:v
    });
    return ctx.reply("📦 چند گیگ؟");
  }


  if (data.step === 2) {
    setState(ctx.from.id, "admin_newplan_step", {
      ...data,
      step:3,
      gb:Number(v)
    });
    return ctx.reply("📅 چند روز؟");
  }


  if (data.step === 3) {
    setState(ctx.from.id, "admin_newplan_step", {
      ...data,
      step:4,
      days:Number(v)
    });
    return ctx.reply("👥 چند کاربر؟");
  }


  if (data.step === 4) {
    setState(ctx.from.id, "admin_newplan_step", {
      ...data,
      step:5,
      ipLimit:Number(v)
    });
    return ctx.reply("💰 قیمت؟");
  }


  if (data.step ===5){

    await db.addPlan(
      data.name,
      data.gb,
      data.days,
      data.ipLimit,
      Number(v)
    );

    clearState(ctx.from.id);

    return ctx.reply(
      `✅ پلن ${data.name} ساخته شد.`
    );
  }
}



bot.command("delplan", async(ctx)=>{

 if(!await db.isAdmin(ctx.from.id)) return;

 const id = Number(ctx.message.text.split(" ")[1]);

 await db.hardDeletePlan(id);

 ctx.reply("🗑 پلن حذف شد.");

});


bot.command("toggleplan", async(ctx)=>{

 if(!await db.isAdmin(ctx.from.id)) return;

 const id = Number(ctx.message.text.split(" ")[1]);

 await db.togglePlan(id);

 ctx.reply("👁 وضعیت پلن تغییر کرد.");

});



bot.command("pending", async(ctx)=>{

 if(!await db.isAdmin(ctx.from.id)) return;


 const orders = await db.listPendingOrders();


 if(!orders.length)
   return ctx.reply("سفارشی نیست.");


 for(const o of orders){

  await ctx.reply(
   `🧾 سفارش #${o.id}\n`+
   `کاربر: ${o.telegram_id}\n`+
   `نام: ${o.custom_name}`,
   kb.receiptReviewKeyboard(o.id)
  );

 }

});

// ═════════════════════════════════════════════════════
// تایید رسید سفارش
// ═════════════════════════════════════════════════════

bot.action(/^approve:(\d+)$/, async (ctx) => {

  try {

    const orderId = Number(ctx.match[1]);

    console.log("APPROVE CLICK:", orderId);



    // چک ادمین

    const admin = await db.isAdmin(ctx.from.id);

    if (!admin) {

      return ctx.answerCbQuery(
        "⛔ دسترسی ندارید",
        {
          show_alert:true
        }
      );

    }




    // گرفتن سفارش

    const order = await db.getOrder(orderId);


    if (!order) {

      return ctx.answerCbQuery(
        "سفارش پیدا نشد",
        {
          show_alert:true
        }
      );

    }




    // گرفتن پلن

    const plan = await db.getPlan(order.plan_id);


    if (!plan) {

      return ctx.answerCbQuery(
        "پلن پیدا نشد",
        {
          show_alert:true
        }
      );

    }





    // ساخت کانفیگ X4G

    const x4gConfig = await x4g.createFullService(

      order.custom_name,

      plan.gb,

      plan.days,

      plan.ip_limit

    );



    console.log(
      "X4G CONFIG CREATED:",
      x4gConfig
    );





    // ذخیره اطلاعات کانفیگ

    await db.setOrderConfig(

      orderId,

      x4gConfig.uuid,

      x4gConfig.vless_link ||
      x4gConfig.config ||
      x4gConfig.url ||
      null,

      x4gConfig.sub_url ||
      x4gConfig.subscription_url ||
      null

    );







    // لینک کانفیگ

    const vless =

      x4gConfig.sub_url ||
      x4gConfig.subscription_url ||
      x4gConfig.vless_link ||
      x4gConfig.config ||
      x4gConfig.url ||

      "کانفیگ ساخته شد";






    // ارسال برای مشتری


    await bot.telegram.sendMessage(

      order.telegram_id,


`✅ سرویس شما فعال شد


📦 نام سرویس:
${order.custom_name}


📋 کانفیگ سرویس:


\`${vless}\`


روی متن بالا نگه دار و کپی کن ✅`,


{
  parse_mode:"Markdown"
}

    );






    // تغییر پیام ادمین


    try {

      await ctx.editMessageCaption(

`✅ تایید شد

🧾 سفارش #${orderId}`

      );


    } catch {


      try {


        await ctx.editMessageText(

`✅ تایید شد

🧾 سفارش #${orderId}`

        );


      } catch {}

    }







    await ctx.answerCbQuery(

      "تایید شد ✅"

    );




  } catch(err) {


    console.log(
      "APPROVE ERROR:",
      err.response?.data || err.message
    );



    await ctx.answerCbQuery(

      "خطا در تایید سفارش",

      {
        show_alert:true
      }

    );

  }

});
// ═════════════════════════════════════════════════════
// رد رسید سفارش
// ═════════════════════════════════════════════════════

bot.action(/^reject:(\d+)$/, async (ctx) => {

  try {

    const orderId = Number(ctx.match[1]);

    console.log("REJECT CLICK:", orderId);



    const admin = await db.isAdmin(ctx.from.id);


    if (!admin) {

      return ctx.answerCbQuery(
        "⛔ دسترسی ندارید",
        {
          show_alert:true
        }
      );

    }



    const order = await db.getOrder(orderId);


    if (!order) {

      return ctx.answerCbQuery(
        "سفارش پیدا نشد",
        {
          show_alert:true
        }
      );

    }



    await db.rejectOrder(orderId);



    try {

      await ctx.editMessageCaption(
        `❌ رد شد\n\n🧾 سفارش #${orderId}`
      );

    } catch {


      try {

        await ctx.editMessageText(
          `❌ رد شد\n\n🧾 سفارش #${orderId}`
        );

      } catch {}

    }




    await bot.telegram.sendMessage(
      order.telegram_id,
      `❌ رسید شما رد شد.\n\n🧾 شماره سفارش: ${orderId}`
    );



    await ctx.answerCbQuery(
      "رد شد ❌"
    );



  } catch(err) {


    console.log(
      "REJECT ERROR:",
      err
    );


    await ctx.answerCbQuery(
      "خطا در رد سفارش",
      {
        show_alert:true
      }
    );


  }

});



// دریافت کانفیگ
bot.action(/^copy:(\d+)$/, async (ctx) => {
  try {
    const order = await db.getOrder(Number(ctx.match[1]));

    if (!order || order.telegram_id !== ctx.from.id) {
      return ctx.answerCbQuery("این سرویس برای شما نیست.", {show_alert:true});
    }

    if (!order.x4g_uuid) {
      return ctx.answerCbQuery("کانفیگ ساخته نشده.", {show_alert:true});
    }

    const data = await x4g.getConfigStatus(order.x4g_uuid);

    const link =
      data.vless_link ||
      data.config ||
      data.url ||
      order.vless_link ||
      "کانفیگ موجود نیست";

    await ctx.reply(
      "📋 کانفیگ سرویس:\n\n" + link
    );

    await ctx.answerCbQuery();

  } catch(err) {
    console.log("COPY ERROR", err);
    await ctx.answerCbQuery("خطا در دریافت کانفیگ", {show_alert:true});
  }
});


// وضعیت سرویس
bot.action(/^status:(\d+)$/, async (ctx) => {
  try {
    const order = await db.getOrder(Number(ctx.match[1]));

    if (!order || order.telegram_id !== ctx.from.id) {
      return ctx.answerCbQuery("این سرویس برای شما نیست.", {show_alert:true});
    }

    const data = await x4g.getConfigStatus(order.x4g_uuid);

    await ctx.reply(
      `📊 وضعیت سرویس\n\n`+
      `فعال: ${data.active ? "✅" : "❌"}\n`+
      `مصرف: ${data.used_fmt || "0"}\n`+
      `حجم: ${data.limit_fmt || "نامحدود"}\n`+
      `روز باقی‌مانده: ${data.days_left ?? "-"}`
    );

    await ctx.answerCbQuery();

  } catch(err) {
    console.log("STATUS ERROR", err);
    await ctx.answerCbQuery("خطا در وضعیت سرویس", {show_alert:true});
  }
});

module.exports = bot;