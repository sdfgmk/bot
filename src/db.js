const { MongoClient } = require("mongodb");

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error("MONGODB_URI is not set in .env");
}

const client = new MongoClient(uri);
let db = null;

async function connectDB() {
  if (db) return db;

  await client.connect();

  db = client.db(
    process.env.MONGODB_DB || "telegram_vpn_bot"
  );

  await db.collection("users").createIndex(
    { telegram_id: 1 },
    { unique: true }
  );

  await db.collection("admins").createIndex(
    { telegram_id: 1 },
    { unique: true }
  );

  await db.collection("plans").createIndex(
    { id: 1 },
    { unique: true }
  );

  await db.collection("orders").createIndex(
    { id: 1 },
    { unique: true }
  );

  return db;
}

async function ensureUser(telegramId, username, fullName) {
  const database = await connectDB();

  await database.collection("users").updateOne(
    { telegram_id: telegramId },
    {
      $set: {
        username,
        full_name: fullName
      },
      $setOnInsert: {
        created_at: new Date().toISOString()
      }
    },
    { upsert: true }
  );
}

async function isAdmin(id) {
  const database = await connectDB();
  return !!await database.collection("admins")
    .findOne({ telegram_id: id });
}

async function addAdmin(id) {
  const database = await connectDB();

  await database.collection("admins").updateOne(
    { telegram_id: id },
    {
      $setOnInsert: {
        telegram_id: id
      }
    },
    { upsert: true }
  );
}

async function allAdminIds() {
  const database = await connectDB();

  const list = await database.collection("admins")
    .find({})
    .toArray();

  return list.map(x => x.telegram_id);
}

async function listPlans(activeOnly = true) {
  const database = await connectDB();

  return database.collection("plans")
    .find(activeOnly ? { active: 1 } : {})
    .sort({ id: 1 })
    .toArray();
}

async function getPlan(id) {
  const database = await connectDB();

  return database.collection("plans")
    .findOne({ id: Number(id) });
}

async function addPlan(name, gb, days, ipLimit, price) {
  const database = await connectDB();

  const last = await database.collection("plans")
    .find({})
    .sort({ id: -1 })
    .limit(1)
    .toArray();

  const id = last.length ? last[0].id + 1 : 1;

  await database.collection("plans").insertOne({
    id,
    name,
    gb: Number(gb),
    days: Number(days),
    ip_limit: Number(ipLimit),
    price: Number(price),
    active: 1
  });

  return id;
}

async function hardDeletePlan(id) {
  const database = await connectDB();

  await database.collection("plans")
    .deleteOne({ id: Number(id) });
}

async function togglePlan(id) {
  const database = await connectDB();

  const plan = await database.collection("plans")
    .findOne({ id: Number(id) });

  if (!plan) return;

  await database.collection("plans").updateOne(
    { id: Number(id) },
    {
      $set: {
        active: plan.active ? 0 : 1
      }
    }
  );
}

async function createOrder(
  telegramId,
  planId,
  customName,
  isRenewal = false,
  renewOfOrderId = null
) {
  const database = await connectDB();

  const last = await database.collection("orders")
    .find({})
    .sort({ id: -1 })
    .limit(1)
    .toArray();

  const id = last.length ? last[0].id + 1 : 1;

  await database.collection("orders").insertOne({
    id,
    telegram_id: telegramId,
    plan_id: Number(planId),
    custom_name: customName,
    status: "pending_receipt",
    is_renewal: isRenewal ? 1 : 0,
    renew_of_order_id: renewOfOrderId,
    x4g_uuid: null,
    vless_link: null,
    receipt_file_id: null,
    receipt_text: null,
    created_at: new Date().toISOString(),
    approved_at: null
  });

  return id;
}

async function attachReceipt(orderId, fileId, text) {
  const database = await connectDB();

  await database.collection("orders").updateOne(
    { id: Number(orderId) },
    {
      $set: {
        receipt_file_id: fileId,
        receipt_text: text,
        status: "pending_review"
      }
    }
  );
}

async function getOrder(id) {
  const database = await connectDB();

  return database.collection("orders")
    .findOne({ id: Number(id) });
}

async function setOrderStatus(orderId, status, uuid = null) {
  const database = await connectDB();

  const data = { status };

  if (uuid) data.x4g_uuid = uuid;

  if (status === "active") {
    data.approved_at = new Date().toISOString();
  }

  await database.collection("orders").updateOne(
    { id: Number(orderId) },
    { $set: data }
  );
}

async function setOrderConfig(orderId, uuid, vlessLink = null) {
  const database = await connectDB();

  await database.collection("orders").updateOne(
    { id: Number(orderId) },
    {
      $set: {
        x4g_uuid: uuid,
        vless_link: vlessLink,
        status: "active",
        approved_at: new Date().toISOString()
      }
    }
  );
}

async function listUserActiveOrders(id) {
  const database = await connectDB();

  return database.collection("orders")
    .find({
      telegram_id: id,
      status: "active"
    })
    .sort({ id: -1 })
    .toArray();
}

async function listPendingOrders() {
  const database = await connectDB();

  return database.collection("orders")
    .find({ status: "pending_review" })
    .sort({ id: 1 })
    .toArray();
}

async function approveOrder(orderId) {
  return setOrderStatus(orderId, "active");
}

async function rejectOrder(orderId) {
  return setOrderStatus(orderId, "rejected");
}

async function seed() {
  const database = await connectDB();

  const admins = (process.env.INITIAL_ADMIN_IDS || "")
    .split(",")
    .filter(Boolean)
    .map(Number);

  for (const id of admins) {
    await addAdmin(id);
  }

  const count = await database.collection("plans")
    .countDocuments();

  if (count === 0) {
    await addPlan("طلایی", 100, 30, 2, 150000);
    await addPlan("نقره‌ای", 50, 30, 1, 90000);
  }
}

module.exports = {
  connectDB,
  seed,
  ensureUser,
  isAdmin,
  addAdmin,
  allAdminIds,
  listPlans,
  getPlan,
  addPlan,
  hardDeletePlan,
  togglePlan,
  createOrder,
  attachReceipt,
  getOrder,
  setOrderStatus,
  setOrderConfig,
  approveOrder,
  rejectOrder,
  listUserActiveOrders,
  listPendingOrders
};
