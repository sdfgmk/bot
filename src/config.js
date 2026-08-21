require("dotenv").config();

module.exports = {
  BOT_TOKEN: process.env.BOT_TOKEN || "",

  // آیدی عددی تلگرام ادمین‌های اولیه، با کاما جدا شده. مثلا "111111,222222"
  INITIAL_ADMIN_IDS: (process.env.INITIAL_ADMIN_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^\d+$/.test(s))
    .map(Number),

  // آدرس پنل X4G روی Railway (بدون اسلش آخر)
  X4G_BASE_URL: (process.env.X4G_BASE_URL || "").replace(/\/$/, ""),

  // همون BOT_API_KEY که روی پنل X4G ست شده
  X4G_BOT_API_KEY: process.env.X4G_BOT_API_KEY || "",

  // آدرس عمومی خود ربات (برای Mini App). روی Railway خودکار از RAILWAY_PUBLIC_DOMAIN میاد.
  PUBLIC_BASE_URL: process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
    : process.env.PUBLIC_BASE_URL || "",

  CARD_NUMBER: process.env.CARD_NUMBER || "0000-0000-0000-0000",
  CARD_OWNER: process.env.CARD_OWNER || "نام صاحب حساب",

  PORT: parseInt(process.env.PORT || "8080", 10),
  DB_PATH: process.env.DB_PATH || "/data/bot.db",
};
