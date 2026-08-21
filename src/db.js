const { MongoClient } = require("mongodb");

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error("MONGODB_URI is not set in .env");
}

const client = new MongoClient(uri);

let db;

async function connectDB() {
  if (db) return db;

  await client.connect();
  db = client.db(process.env.MONGODB_DB || "telegram_vpn_bot");

  await db.collection("users").createIndex(
    { telegram_id: 1 },
    { unique: true }
  );

  await db.collection("admins").createIndex(
    { telegram_id: 1 },
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
        full_name: fullName,
      },
      $setOnInsert: {
        created_at: new Date().toISOString(),
      },
    },
    { upsert: true }
  );
}

async function isAdmin(telegramId) {
  const database = await connectDB();

  return !!(await database.collection("admins").findOne({
    telegram_id: telegramId,
  }));
}

async function addAdmin(telegramId) {
  const database = await connectDB();

  await database.collection("admins").updateOne(
    { telegram_id: telegramId },
    {
      $setOnInsert: {
        telegram_id: telegramId,
      },
    },
    { upsert: true }
  );
}

async function allAdminIds() {
  const database = await connectDB();

  const admins = await database
    .collection("admins")
    .find({})
    .toArray();

  return admins.map((x) => x.telegram_id);
}

async function listPlans(activeOnly = true) {
  const database = await connectDB();

  const query = activeOnly ? { active: 1 } : {};

  return database
    .collection("plans")
    .find(query)
    .sort({ id: 1 })
    .toArray();
}

async function getPlan(id) {
  const database = await connectDB();

  return database.collection("plans").findOne({
    id: Number(id),
  });
}

async function addPlan(name, gb, days, ipLimit, price) {
  const database = await connectDB();

  const last = await database
    .collection("plans")
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
    active: 1,
  });

  return id;
}

async function deletePlan(id) {
  const database = await connectDB();

  await database.collection("plans").updateOne(
    { id: Number(id) },
    { $set: { active: 0 } }
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

  const last = await database
    .collection("orders")
    .find({})
    .sort({ id: -1 })
    .limit(1)
    .toArray();

  const id = last.length ? last[0].id + 1 : 1;

  await database.collection("orders").insertOne({
    id,
    telegram_id: telegramId,
    plan_id: planId,
    custom_name: customName,
    status: "pending_receipt",
    is_renewal: isRenewal ? 1 : 0,
    renew_of_order_id: renewOfOrderId,
    x4g_uuid: null,
    receipt_file_id: null,
    receipt_text: null,
    created_at: new Date().toISOString(),
    approved_at: null,
    admin_note: null,
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
        status: "pending_review",
      },
    }
  );
}

async function getOrder(id) {
  const database = await connectDB();

  return database.collection("orders").findOne({
    id: Number(id),
  });
}

async function setOrderStatus(
  orderId,
  status,
  x4gUuid = null,
  note = null
) {
  const database = await connectDB();

  const update = {
    $set: {
      status,
    },
  };

  if (x4gUuid !== null) {
    update.$set.x4g_uuid = x4gUuid;
  }

  if (note !== null) {
    update.$set.admin_note = note;
  }

  if (status === "active") {
    update.$set.approved_at = new Date().toISOString();
  }

  await database.collection("orders").updateOne(
    { id: Number(orderId) },
    update
  );
}

async function listUserActiveOrders(telegramId) {
  const database = await connectDB();

  return database
    .collection("orders")
    .find({
      telegram_id: telegramId,
      status: "active",
    })
    .sort({ id: -1 })
    .toArray();
}

async function listPendingOrders() {
  const database = await connectDB();

  return database
    .collection("orders")
    .find({
      status: "pending_review",
    })
    .sort({ id: 1 })
    .toArray();
}

async function seed() {
  const database = await connectDB();

  const adminIds = (process.env.INITIAL_ADMIN_IDS || "")
    .split(",")
    .map((x) => x.trim())
    .filter((x) => /^\d+$/.test(x))
    .map(Number);

  for (const id of adminIds) {
    await addAdmin(id);
  }

  const count = await database.collection("plans").countDocuments();

  if (count === 0) {
    await addPlan(
      "1 ماهه - 10 گیگ - 1 کاربر",
      10,
      30,
      1,
      0
    );

    await addPlan(
      "1 ماهه - 30 گیگ - 2 کاربر",
      30,
      30,
      2,
      0
    );

    await addPlan(
      "3 ماهه - 50 گیگ - 2 کاربر",
      50,
      90,
      2,
      0
    );
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
  deletePlan,
  createOrder,
  attachReceipt,
  getOrder,
  setOrderStatus,
  listUserActiveOrders,
  listPendingOrders,
};