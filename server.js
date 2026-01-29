const mqtt = require("mqtt");
const { Client } = require("pg");
const http = require("http");

// 📡 Conexión a HiveMQ
const mqttClient = mqtt.connect(
  "wss://8d8ef16cb5534dacbca2b130fa00d5b2.s1.eu.hivemq.cloud:8884/mqtt",
  {
    username: "AlineCampos2",
    password: "Cedric.2020",
    protocol: "wss",
  }
);

// 🛢️ Conexión a PostgreSQL (Render ia-kine-db)
const db = new Client({
  user: "ia_kine_db_user",
  host: "dpg-d4cmbkidbo4c73dbk9kg-a.oregon-postgres.render.com",
  database: "ia_kine_db",
  password: "AwZDbVALe4ZtYfh1dDxjHiVe7Ks1pSnV",
  port: 5432,
  ssl: { rejectUnauthorized: false },
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

   // 👇 TABLA BIM (Excel ⇄ VR)
  await db.query(`
    CREATE TABLE IF NOT EXISTS bim_estados (
      id SERIAL PRIMARY KEY,
      elemento_id TEXT UNIQUE,
      sector TEXT,
      tipo TEXT,
      fila INTEGER,
      columna INTEGER,
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
      await db.query(
        "INSERT INTO temperatura (valor, timestamp) VALUES ($1, $2)",
        [parseFloat(valor), now]
      );
    } else if (topic === "aline/humedad") {
      await db.query(
        "INSERT INTO humedad (valor, timestamp) VALUES ($1, $2)",
        [parseFloat(valor), now]
      );
    } else if (topic === "aline/aire") {
      await db.query(
        "INSERT INTO aire (valor, timestamp) VALUES ($1, $2)",
        [parseInt(valor), now]
      );
    } else if (topic === "aline/sectorA" || topic === "aline/sectorB") {
      const sector = topic.includes("A") ? "A" : "B";
      await db.query(
        "INSERT INTO sectores (sector, estado, timestamp) VALUES ($1, $2, $3)",
        [sector, valor, now]
      );
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
  .catch((err) => console.error("❌ Error conectando DB:", err));

// 🔍 Helper: obtener último dato combinado (temp + hum + aire)
async function getUltimoSensores() {
  const [t, h, a] = await Promise.all([
    db.query(
      "SELECT valor, timestamp FROM temperatura ORDER BY timestamp DESC LIMIT 1"
    ),
    db.query(
      "SELECT valor, timestamp FROM humedad ORDER BY timestamp DESC LIMIT 1"
    ),
    db.query(
      "SELECT valor, timestamp FROM aire ORDER BY timestamp DESC LIMIT 1"
    ),
  ]);

  const tempRow = t.rows[0] || {};
  const humRow = h.rows[0] || {};
  const aireRow = a.rows[0] || {};

  return {
    temp: tempRow.valor ?? null,
    hum: humRow.valor ?? null,
    mq135: aireRow.valor ?? null,
    timestamp:
      tempRow.timestamp || humRow.timestamp || aireRow.timestamp || null,
  };
}

// 🌐 Servidor HTTP simple con CORS + endpoints
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

  const url = new URL(req.url, `http://${req.headers.host}`);

    // ---- IA: predicción de sensores -------------------------
  if (url.pathname === "/api/ia/sensores/forecast" && req.method === "GET") {
    try {
      const IA_URL = "https://ia-forecast-service.onrender.com/forecast/sensores";

      console.log("Consultando IA en:", IA_URL);

      const r = await fetch(IA_URL);
      const json = await r.json();

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(json));
    } catch (error) {
      console.error("❌ Error llamando a IA:", error.message);

      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "Error llamando IA" }));
    }
    return;
  }


  // ---- último registro ----
  if (url.pathname === "/api/sensores/ultimo" && req.method === "GET") {
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

  // ---- HISTORIAL: /api/sensores/historial?tipo=temp|hum|mq135 ----
  if (url.pathname === "/api/sensores/historial" && req.method === "GET") {
    const tipo = url.searchParams.get("tipo") || "temp";
    const mapTabla = {
      temp: "temperatura",
      hum: "humedad",
      mq135: "aire",
    };

    if (!mapTabla[tipo]) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "tipo inválido" }));
      return;
    }

    try {
      const tabla = mapTabla[tipo];
      const q = await db.query(
        `SELECT valor, timestamp FROM ${tabla} ORDER BY timestamp ASC LIMIT 5000`
      );
      const data = q.rows.map((r) => ({
        timestamp: r.timestamp,
        value: r.valor,
      }));

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, data }));
    } catch (e) {
      console.error("❌ Error en /api/sensores/historial:", e.message);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "Server error" }));
    }
    return;
  }

  // ---- BIM: obtener estado por elemento --------------------
if (url.pathname === "/api/bim/estado" && req.method === "GET") {
  try {
    const q = await db.query(`
      SELECT elemento_id, estado
      FROM bim_estados
    `);

    const data = {};
    q.rows.forEach(r => {
      data[r.elemento_id] = r.estado;
    });

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, data }));
  } catch (e) {
    console.error("❌ Error BIM estado:", e.message);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: false }));
  }
  return;
}

  // ---- BIM: guardar estado de columna / viga -------------------------
if (url.pathname === "/api/bim/estado" && req.method === "POST") {
  let body = "";

  req.on("data", chunk => {
    body += chunk.toString();
  });

  req.on("end", async () => {
    try {
      const { elemento_id, estado } = JSON.parse(body);

      if (!elemento_id || !estado) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: "datos incompletos" }));
        return;
      }

      await db.query(
        `
        INSERT INTO bim_estados (elemento_id, estado, timestamp)
        VALUES ($1, $2, NOW())
        ON CONFLICT (elemento_id)
        DO UPDATE SET estado = $2, timestamp = NOW()
        `,
        [elemento_id, estado]
      );

      console.log(`🏗️ BIM actualizado: ${elemento_id} → ${estado}`);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    } catch (err) {
      console.error("❌ Error BIM:", err.message);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "server error" }));
    }
  });

  return;
}



  // Ruta raíz: texto simple
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Servidor MQTT + PostgreSQL activo 🚀");
});

server.listen(PORT, () => {
  console.log(`🌐 Servidor escuchando en el puerto ${PORT}`);
});
