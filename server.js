const mqtt = require("mqtt");
const { Client } = require("pg");
const http = require("http");

// 📡 Conexión a HiveMQ
const mqttClient = mqtt.connect("wss://8d8ef16cb5534dacbca2b130fa00d5b2.s1.eu.hivemq.cloud:8884/mqtt", {
  username: "AlineCampos2",
  password: "Cedric.2020",
  protocol: "wss"
});

// 🛢️ Conexión a PostgreSQL (Render ia-kine-db)
const db = new Client({
  user: "ia_kine_db_user",
  host: "dpg-d4cmbkidbo4c73dbk9kg-a.oregon-postgres.render.com",
  database: "ia_kine_db",
  password: "AwZDbVALe4ZtYfh1dDxjHiVe7Ks1pSnV",
  port: 5432,
  ssl: { rejectUnauthorized: false }
});

// 🏗️ Crear tablas si no existen
const crearTablas = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS temperatura (
      id SERIAL PRIMARY KEY,
      valor REAL,
      timestamp TIMESTAMP
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS humedad (
      id SERIAL PRIMARY KEY,
      valor REAL,
      timestamp TIMESTAMP
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS aire (
      id SERIAL PRIMARY KEY,
      valor INTEGER,
      timestamp TIMESTAMP
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS sectores (
      id SERIAL PRIMARY KEY,
      sector TEXT,
      estado TEXT,
      timestamp TIMESTAMP
    );
  `);

  console.log("✅ Tablas creadas/verificadas");
};

// 🔄 Procesar mensajes MQTT
mqttClient.on("connect", () => {
  console.log("✅ Conectado a MQTT HiveMQ");
  mqttClient.subscribe("aline/#");
});

mqttClient.on("message", async (topic, message) => {
  const valor = message.toString();
  const now = new Date();

  try {
    if (topic === "aline/temperatura") {
      await db.query("INSERT INTO temperatura (valor, timestamp) VALUES ($1, $2)", [parseFloat(valor), now]);
    } else if (topic === "aline/humedad") {
      await db.query("INSERT INTO humedad (valor, timestamp) VALUES ($1, $2)", [parseFloat(valor), now]);
    } else if (topic === "aline/aire") {
      await db.query("INSERT INTO aire (valor, timestamp) VALUES ($1, $2)", [parseInt(valor), now]);
    } else if (topic === "aline/sectorA" || topic === "aline/sectorB") {
      const sector = topic.includes("A") ? "A" : "B";
      await db.query("INSERT INTO sectores (sector, estado, timestamp) VALUES ($1, $2, $3)", [sector, valor, now]);
    }
    console.log(`💾 Guardado: ${topic} -> ${valor}`);
  } catch (err) {
    console.error("❌ Error al guardar dato:", err.message);
  }
});

// 🔌 Conectar DB y lanzar setup
db.connect()
  .then(() => {
    console.log("✅ Conectado a PostgreSQL");
    return crearTablas();
  })
  .catch(err => console.error("❌ Error conectando DB:", err));

// 🔍 Helper: obtener último dato combinado (temp + hum + aire)
async function getUltimoSensores() {
  const [t, h, a] = await Promise.all([
    db.query("SELECT valor, timestamp FROM temperatura ORDER BY timestamp DESC LIMIT 1"),
    db.query("SELECT valor, timestamp FROM humedad ORDER BY timestamp DESC LIMIT 1"),
    db.query("SELECT valor, timestamp FROM aire ORDER BY timestamp DESC LIMIT 1")
  ]);

  const tempRow = t.rows[0] || {};
  const humRow  = h.rows[0] || {};
  const aireRow = a.rows[0] || {};

  return {
    temp: tempRow.valor ?? null,
    hum:  humRow.valor ?? null,
    mq135: aireRow.valor ?? null,
    timestamp:
      tempRow.timestamp ||
      humRow.timestamp ||
      aireRow.timestamp ||
      null
  };
}

// 🌐 Servidor HTTP simple con CORS
const PORT = process.env.PORT || 10000;

const server = http.createServer(async (req, res) => {
  // CORS básico
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === "/api/sensores/ultimo" && req.method === "GET") {
    try {
      const data = await getUltimoSensores();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, data }));
    } catch (e) {
      console.error("❌ Error en /api/sensores/ultimo:", e.message);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "Server error" }));
    }
    return;
  }

  // Ruta raíz: texto simple
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Servidor MQTT + PostgreSQL activo 🚀");
});

server.listen(PORT, () => {
  console.log(`🌐 Servidor escuchando en el puerto ${PORT}`);
});
