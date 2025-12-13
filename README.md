Este archivo server.js es el backend central del proyecto IoT VR BIM.
Su función es actuar como puente entre sensores IoT, base de datos, IA y el visor VR.

¿Qué hace este servidor?
En términos simples, el servidor:

Recibe datos IoT por MQTT (HiveMQ).
Guarda los datos en PostgreSQL (Render).
Expone una API HTTP para que el visor VR lea:
  últimos valores de sensores
  historial de sensores
Consulta un microservicio de IA (Prophet) y entrega sus predicciones al visor VR.

Tecnologías usadas

Node.js – backend principal
MQTT (HiveMQ) – comunicación IoT
PostgreSQL (Render) – almacenamiento de datos
HTTP nativo (Node) – API REST
IA externa (Python + Prophet) – predicción de sensores

detalle
1. Conexión a MQTT (HiveMQ)
   con : mqttClient.subscribe("aline/#");
   El servidor se conecta al broker HiveMQ y se suscribe a todos los tópicos que comienzan con: aline/
   Cada mensaje recibido representa una lectura de sensor o estado de sector

2. Base de datos PostgreSQL
  Al iniciar, el servidor:
  Se conecta a la base ia_kine_db
  Crea automáticamente las tablas si no existen:
  Cada registro guarda:valor y timestamp


3. Procesamiento de mensajes MQTT
  Cuando llega un mensaje MQTT: mqttClient.on("message", async (topic, message) => { ... })
  El servidor:
    Identifica el tópico
    Convierte el valor recibido
    Inserta el dato en la tabla correspondiente
   
4. Servidor HTTP (API REST)
El servidor expone una API HTTP con CORS habilitado, para que el visor VR pueda consultar datos sin restricciones.

  Endpoint: último valor de sensores: GET /api/sensores/ultimo
  Devuelve el último valor registrado de: temperatura, humedad y aire
  Ejemplo de respuesta:
  json
  {
    "ok": true,
    "data": {
      "temp": 22.4,
      "hum": 55,
      "mq135": 80,
      "timestamp": "2025-12-10T12:30:00Z"
    }
  }
  
Endpoint: historial de sensores: GET /api/sensores/historial?tipo=temp|hum|mq135
Devuelve el historial (hasta 5000 registros) para:
  graficar datos
  análisis temporal
  visualización en VR

Endpoint: IA – predicción de sensores: GET /api/ia/sensores/forecast
Este endpoint:
  No calcula la IA directamente
  Llama a un microservicio externo de IA (Python + Prophet)
  Devuelve la predicción al visor VR: https://ia-forecast-service.onrender.com/forecast/sensores
  Esto permite:
    mantener Node.js liviano
    usar modelos de IA especializados en Python
    escalar la IA de forma independiente

5. Uso desde el visor VR

El visor VR solo necesita comunicarse con este backend:
fetch("/api/sensores/ultimo");
fetch("/api/sensores/historial?tipo=temp");
fetch("/api/ia/sensores/forecast");

El backend se encarga de:
  hablar con la base de datos
  hablar con la IA
  entregar datos listos para visualizar

