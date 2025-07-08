const mqtt = require("mqtt");
const { Client } = require("pg");

// 📡 Conexión a HiveMQ
const mqttClient = mqtt.connect("wss://8d8ef16cb5534dacbca2b130fa00d5b2.s1.eu.hivemq.cloud:8884/mqtt", {
  username: "AlineCampos2",
  password: "Cedric.2020",
  protocol: "wss"
});

// 🛢️ Conexión a PostgreSQL (usa tus datos reales de Render)
const db = new Client({
  user: "tesis_db_07ex_user",
  host: "dpg-d1miiube5dus73bj9f30-a",
  database: "tesis_db_07ex",
  password: "tu_clave_segura",
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
