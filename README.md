# 🤖 ربات فروش کانفیگ VPN (Node.js + React)

نسخه‌ی Node.js ربات — بک‌اند با **Express + Telegraf**، Mini App وضعیت سرویس با **React** (بدون نیاز به مرحله‌ی build، مستقیم توی مرورگر با Babel اجرا میشه).

پنل [X4G](https://github.com/) که کانفیگ واقعی VLESS رو می‌سازه، همونطور **پایتون** می‌مونه و از طریق API باهاش صحبت می‌کنیم — کد اون سرویس نیازی به تغییر نداره (قبلاً یه بار endpoint های `/api/bot/configs/...` رو بهش اضافه کردیم).

---

## 📁 ساختار پروژه

```
bot-node/
├── src/
│   ├── server.js       # نقطه‌ی ورود؛ Express + اجرای ربات با هم
│   ├── config.js        # تنظیمات از Environment Variables
│   ├── db.js             # دیتابیس SQLite (better-sqlite3)
│   ├── x4gClient.js     # ارتباط با API پنل X4G
│   ├── keyboards.js      # کیبوردهای تلگرام
│   └── bot.js            # همه‌ی منطق ربات (خرید، ادمین، تمدید)
├── public/
│   ├── status.html       # صفحه‌ی React Mini App (وضعیت سرویس)
│   └── style.css
├── package.json
└── .env.example
```

---

## 🚀 مراحل راه‌اندازی

### ۱. نصب و اجرای لوکال (اختیاری، برای تست قبل از دیپلوی)
```bash
cd bot-node
npm install
cp .env.example .env   # مقدارها رو پر کن
npm start
```

### ۲. دیپلوی روی Railway
1. این پوشه رو به یه ریپازیتوری گیت‌هاب جدید push کن.
2. Railway → **New Project → Deploy from GitHub repo** → ریپو رو انتخاب کن.
3. یه **Volume** به مسیر `/data` وصل کن (Settings → Volumes) تا دیتابیس با هر ری‌استارت پاک نشه.
4. Environment Variables رو طبق `.env.example` پر کن:

| متغیر | توضیح |
|---|---|
| `BOT_TOKEN` | توکن از BotFather |
| `INITIAL_ADMIN_IDS` | آیدی عددی تلگرام خودت |
| `X4G_BASE_URL` | آدرس پنل X4G (بدون اسلش آخر) |
| `X4G_BOT_API_KEY` | همون `BOT_API_KEY` که روی X4G ست کردی |
| `CARD_NUMBER` / `CARD_OWNER` | اطلاعات کارت برای پرداخت دستی |

5. یه **Public Domain** برای این سرویس هم از تنظیمات Railway فعال کن (لازمه که Mini App کار کنه).
6. توی BotFather → `/mybots` → رباتت → Bot Settings → آدرس `https://<دامنه-ربات>/status` رو به‌عنوان Mini App ثبت کن.

---

## 👤 کاربر

- `/start` → منو
- **🛒 خرید سرویس جدید** → انتخاب پلن → اسم دلخواه → پرداخت دستی → ارسال رسید
- **📦 سرویس‌های من** → لیست سرویس‌ها → **📊 وضعیت سرویس** (Mini App با React) یا **🔄 تمدید**

## 🛠 ادمین

هر آیدی که توی `INITIAL_ADMIN_IDS` باشه ادمینه.
- `/newplan` → ساخت پلن (نام, حجم GB, روز, تعداد کاربر, قیمت)
- `/plans` → لیست پلن‌ها
- `/pending` → سفارش‌های در انتظار تایید (با دکمه‌ی تایید/رد)

---

## ⚠️ نکات مهم

- دیتابیس SQLite توی `/data/bot.db` ذخیره میشه — حتماً Volume وصل کن.
- صفحه‌ی React از CDN (`unpkg.com`) لود میشه، پس نیازی به `npm run build` یا Webpack/Vite نیست — همین که فایل static سرو بشه کافیه.
- این نسخه فقط **VLESS** پشتیبانی می‌کنه.
