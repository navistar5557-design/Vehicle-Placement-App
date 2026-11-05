import "dotenv/config";
import express from "express";
import cors from "cors";
import { MongoClient, ServerApiVersion } from "mongodb";

const PORT = Number(process.env.PORT || 8080);
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB || "cube_vehicle_placement";

if (!MONGODB_URI) {
  throw new Error("MONGODB_URI is required. Set it as a server environment variable.");
}

const client = new MongoClient(MONGODB_URI, {
  family: 4,
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true
  }
});

const db = client.db(DB_NAME);

const vehicles = db.collection("vehicles");
const vendors = db.collection("vendors");
const locations = db.collection("locations");
const trips = db.collection("trips");
const settings = db.collection("settings");
const auditLogs = db.collection("audit_logs");

let databaseReady = false;
let lastDatabaseError = null;

async function initializeDatabase() {
  try {
    await client.connect();
    await Promise.all([
      vehicles.createIndex({ number: 1 }, { unique: true }),
      vendors.createIndex({ name: 1 }, { unique: true }),
      locations.createIndex({ name: 1 }, { unique: true }),
      trips.createIndex({ id: 1 }, { unique: true }),
      trips.createIndex({ createdAt: -1 }),
      auditLogs.createIndex({ createdAt: -1 })
    ]);
    databaseReady = true;
    lastDatabaseError = null;
    console.log("MongoDB connected successfully");
  } catch (error) {
    databaseReady = false;
    lastDatabaseError = error?.message || String(error);
    console.error("MongoDB connection failed:", lastDatabaseError);
  }
}

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

const clean = value => typeof value === "string" ? value.trim() : value;
const active = doc => ({ ...doc, active: doc.active !== false });

async function audit(action, entityType, before = null, after = null) {
  await auditLogs.insertOne({
    action,
    entityType,
    before,
    after,
    createdAt: new Date()
  });
}

app.get("/health", async (_req, res) => {
  let ping = false;
  if (databaseReady) {
    try {
      await db.command({ ping: 1 });
      ping = true;
    } catch (error) {
      databaseReady = false;
      lastDatabaseError = error?.message || String(error);
    }
  }
  res.json({
    ok: true,
    service: "cube-vehicle-placement-api",
    database: DB_NAME,
    databaseReady: databaseReady && ping,
    databaseError: databaseReady && ping ? null : lastDatabaseError
  });
});

app.use("/api", (_req, res, next) => {
  if (!databaseReady) {
    return res.status(503).json({
      error: "Database connection is not ready",
      detail: lastDatabaseError
    });
  }
  next();
});

app.get("/api/bootstrap", async (_req, res) => {
  const [vehicleRows, vendorRows, locationRows, tripRows, fuelDoc] = await Promise.all([
    vehicles.find({}).sort({ number: 1 }).toArray(),
    vendors.find({}).sort({ name: 1 }).toArray(),
    locations.find({}).sort({ name: 1 }).toArray(),
    trips.find({}).sort({ createdAt: -1 }).toArray(),
    settings.findOne({ key: "fuelRate" })
  ]);
  res.json({
    vehicles: vehicleRows,
    vendors: vendorRows,
    locations: locationRows,
    trips: tripRows,
    fuelRate: fuelDoc?.value ?? 100
  });
});

app.get("/api/vehicles", async (_req, res) => {
  res.json(await vehicles.find({}).sort({ number: 1 }).toArray());
});

app.post("/api/vehicles", async (req, res) => {
  const number = clean(req.body.number)?.toUpperCase();
  const mileage = Number(req.body.mileage);
  if (!number) return res.status(400).json({ error: "Vehicle number is required" });
  if (mileage < 2.5 || mileage > 6.0) return res.status(400).json({ error: "Mileage must be between 2.5 and 6.0" });

  const doc = active({ number, mileage, createdAt: new Date(), updatedAt: new Date() });
  await vehicles.insertOne(doc);
  await audit("create", "vehicle", null, doc);
  res.status(201).json(doc);
});

app.put("/api/vehicles/:number", async (req, res) => {
  const oldNumber = decodeURIComponent(req.params.number).toUpperCase();
  const newNumber = clean(req.body.number)?.toUpperCase();
  const mileage = Number(req.body.mileage);
  if (!newNumber) return res.status(400).json({ error: "Vehicle number is required" });
  if (mileage < 2.5 || mileage > 6.0) return res.status(400).json({ error: "Mileage must be between 2.5 and 6.0" });

  const before = await vehicles.findOne({ number: oldNumber });
  if (!before) return res.status(404).json({ error: "Vehicle not found" });

  await vehicles.updateOne(
    { number: oldNumber },
    { $set: { number: newNumber, mileage, active: req.body.active ?? before.active ?? true, updatedAt: new Date() } }
  );
  if (oldNumber !== newNumber) {
    await trips.updateMany({ vehicle: oldNumber }, { $set: { vehicle: newNumber } });
  }
  const after = await vehicles.findOne({ number: newNumber });
  await audit("update", "vehicle", before, after);
  res.json(after);
});

app.get("/api/vendors", async (_req, res) => {
  res.json(await vendors.find({}).sort({ name: 1 }).toArray());
});

app.post("/api/vendors", async (req, res) => {
  const name = clean(req.body.name);
  if (!name) return res.status(400).json({ error: "Vendor name is required" });
  const doc = active({ name, createdAt: new Date(), updatedAt: new Date() });
  await vendors.insertOne(doc);
  await audit("create", "vendor", null, doc);
  res.status(201).json(doc);
});

app.put("/api/vendors/:name", async (req, res) => {
  const oldName = decodeURIComponent(req.params.name);
  const newName = clean(req.body.name);
  if (!newName) return res.status(400).json({ error: "Vendor name is required" });

  const before = await vendors.findOne({ name: oldName });
  if (!before) return res.status(404).json({ error: "Vendor not found" });

  await vendors.updateOne(
    { name: oldName },
    { $set: { name: newName, active: req.body.active ?? before.active ?? true, updatedAt: new Date() } }
  );
  if (oldName !== newName) {
    await trips.updateMany({ vendor: oldName }, { $set: { vendor: newName } });
  }
  const after = await vendors.findOne({ name: newName });
  await audit("update", "vendor", before, after);
  res.json(after);
});

app.get("/api/locations", async (_req, res) => {
  res.json(await locations.find({}).sort({ name: 1 }).toArray());
});

app.post("/api/locations", async (req, res) => {
  const name = clean(req.body.name);
  if (!name) return res.status(400).json({ error: "Location name is required" });
  const doc = active({ name, createdAt: new Date(), updatedAt: new Date() });
  await locations.insertOne(doc);
  await audit("create", "location", null, doc);
  res.status(201).json(doc);
});

app.put("/api/locations/:name", async (req, res) => {
  const oldName = decodeURIComponent(req.params.name);
  const newName = clean(req.body.name);
  if (!newName) return res.status(400).json({ error: "Location name is required" });

  const before = await locations.findOne({ name: oldName });
  if (!before) return res.status(404).json({ error: "Location not found" });

  await locations.updateOne(
    { name: oldName },
    { $set: { name: newName, active: req.body.active ?? before.active ?? true, updatedAt: new Date() } }
  );
  if (oldName !== newName) {
    await trips.updateMany(
      { $or: [{ currentLocation: oldName }, { from: oldName }, { to: oldName }] },
      [
        {
          $set: {
            currentLocation: { $cond: [{ $eq: ["$currentLocation", oldName] }, newName, "$currentLocation"] },
            from: { $cond: [{ $eq: ["$from", oldName] }, newName, "$from"] },
            to: { $cond: [{ $eq: ["$to", oldName] }, newName, "$to"] }
          }
        }
      ]
    );
  }
  const after = await locations.findOne({ name: newName });
  await audit("update", "location", before, after);
  res.json(after);
});

app.get("/api/trips", async (req, res) => {
  const query = {};
  if (req.query.vehicle) query.vehicle = req.query.vehicle;
  if (req.query.vendor) query.vendor = req.query.vendor;
  if (req.query.from) query.from = req.query.from;
  if (req.query.to) query.to = req.query.to;

  if (req.query.start || req.query.end) {
    query.createdAt = {};
    if (req.query.start) query.createdAt.$gte = Number(req.query.start);
    if (req.query.end) query.createdAt.$lte = Number(req.query.end);
  }

  res.json(await trips.find(query).sort({ createdAt: -1 }).toArray());
});

app.post("/api/trips", async (req, res) => {
  const doc = { ...req.body, createdAt: Number(req.body.createdAt || Date.now()), updatedAt: new Date() };
  if (!doc.id || !doc.vehicle || !doc.vendor) {
    return res.status(400).json({ error: "Trip id, vehicle and vendor are required" });
  }
  await trips.insertOne(doc);
  await audit("create", "trip", null, doc);
  res.status(201).json(doc);
});

app.put("/api/trips/:id", async (req, res) => {
  const before = await trips.findOne({ id: req.params.id });
  if (!before) return res.status(404).json({ error: "Trip not found" });
  await trips.updateOne({ id: req.params.id }, { $set: { ...req.body, id: req.params.id, updatedAt: new Date() } });
  const after = await trips.findOne({ id: req.params.id });
  await audit("update", "trip", before, after);
  res.json(after);
});

app.delete("/api/trips/:id", async (req, res) => {
  const before = await trips.findOne({ id: req.params.id });
  if (!before) return res.status(404).json({ error: "Trip not found" });
  await trips.deleteOne({ id: req.params.id });
  await audit("delete", "trip", before, null);
  res.status(204).end();
});

app.get("/api/fuel-rate", async (_req, res) => {
  const doc = await settings.findOne({ key: "fuelRate" });
  res.json({ fuelRate: doc?.value ?? 100 });
});

app.put("/api/fuel-rate", async (req, res) => {
  const value = Number(req.body.fuelRate);
  if (!(value > 0)) return res.status(400).json({ error: "Fuel rate must be greater than zero" });
  await settings.updateOne(
    { key: "fuelRate" },
    { $set: { value, updatedAt: new Date() } },
    { upsert: true }
  );
  await audit("update", "fuelRate", null, { value });
  res.json({ fuelRate: value });
});

app.use((error, _req, res, _next) => {
  console.error(error);
  if (error?.code === 11000) {
    return res.status(409).json({ error: "Duplicate value" });
  }
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log("CUBE Vehicle Placement API listening on port " + PORT);
  initializeDatabase();
  setInterval(() => {
    if (!databaseReady) initializeDatabase();
  }, 30000);
});

process.on("SIGTERM", async () => {
  await client.close();
  process.exit(0);
});
