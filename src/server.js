const express = require("express");
const path = require("path");
const config = require("./config");
const x4g = require("./x4gClient");
const bot = require("./bot");
const db = require("./db");

const app = express();

app.use(express.static(path.join(__dirname, "..", "public")));

// ── API وضعیت کانفیگ ────────────────────────────────────────────────────────
app.get("/api/status/:uid", async (req, res) => {
  try {
    const data = await x4g.getConfigStatus(req.params.uid);
    res.json(data);
  } catch (e) {
    res.status(502).json({
      error: e.message
    });
  }
});

app.get("/health", (req, res) => {
  res.json({
    ok: true
  });
});

// صفحه وضعیت
app.get("/status", (req, res) => {
  res.sendFile(
    path.join(__dirname, "..", "public", "status.html")
  );
});


async function main() {

  if (!config.BOT_TOKEN) {
    throw new Error(
      "BOT_TOKEN تنظیم نشده. توی Environment Variables مقداردهیش کن."
    );
  }


  // ثبت ادمین‌ها و ساخت اطلاعات اولیه دیتابیس
  await db.seed();


  // حذف webhook قبلی و شروع polling
  await bot.telegram.deleteWebhook({
    drop_pending_updates: true
  });


  await bot.launch();

  console.log("Bot polling started");


  app.listen(
    config.PORT,
    "0.0.0.0",
    () => {
      console.log(
        `Web server started on port ${config.PORT}`
      );
    }
  );
}


main().catch((e) => {
  console.error(e);
  process.exit(1);
});


process.once("SIGINT", () => {
  bot.stop("SIGINT");
});


process.once("SIGTERM", () => {
  bot.stop("SIGTERM");
});