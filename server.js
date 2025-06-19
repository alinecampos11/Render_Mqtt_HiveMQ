const http = require('http');
const WebSocket = require('ws');
const mqtt = require('mqtt');

const PORT = process.env.PORT || 3000;

// Servidor HTTP básico
const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Servidor WebSocket conectado');
});

// WebSocket Server
const wss = new WebSocket.Server({ server });

// Función para enviar datos a todos los clientes WebSocket conectados
function broadcast(data) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

// 🔁 CAMBIAR según tu nuevo broker
const mqttClient = mqtt.connect('mqtt://broker.hivemq.com'); // o el que estés usando ahora
mqttClient.on('connect', () => {
  console.log('🔌 Conectado a broker MQTT');
  mqttClient.subscribe('aline/#'); // suscribe todos los temas relacionados
});

mqttClient.on('message', (topic, payload) => {
  const msg = {
    topic,
    value: payload.toString(),
    time: new Date().toISOString()
  };
  console.log('📡', msg);
  broadcast(msg);
});

// Iniciar servidor HTTP
server.listen(PORT, () => {
  console.log(`🟢 Servidor WebSocket activo en puerto ${PORT}`);
});
