A Forecast Service – Prophet

Este servicio implementa un microservicio de Inteligencia Artificial para la predicción de sensores IoT, utilizando el modelo Prophet sobre datos históricos almacenados en PostgreSQL.

Forma parte del proyecto IoT + VR + BIM, y se comunica con el backend principal (server.js) mediante HTTP.


Función principal

El servicio:

  Se conecta a una base de datos PostgreSQL
  
  Lee datos históricos de sensores IoT
  
  Entrena modelos de predicción con Prophet
  
  Genera predicciones futuras
  
  Expone los resultados mediante una API REST
Este servicio no recibe datos MQTT directamente; solo analiza datos ya almacenados

Estructura del servicio
ia-forecast-service/
├── app.py              # Microservicio IA (Flask + Prophet)
├── requirements.txt    # Dependencias Python
├── runtime.txt         # Versión de Python para Render
└── README.md           # Documentación del servicio


Tecnologías utilizadas
| Tecnología | Uso                                      |
| ---------- | ---------------------------------------- |
| Python     | Lenguaje base                            |
| Flask      | API REST                                 |
| Flask-CORS | Permitir acceso desde frontend / backend |
| Pandas     | Manipulación de datos                    |
| Prophet    | Predicción de series temporales          |
| PostgreSQL | Fuente de datos históricos               |
| Render     | Despliegue en la nube                    |


Conexión a la base de datos

La conexión se realiza mediante la variable de entorno: DATABASE_URL

Render la inyecta automáticamente al vincular el servicio con la base de datos.
  DB_URL = os.environ.get("DATABASE_URL")
  
  def get_conn():
      return psycopg2.connect(DB_URL, sslmode="require")


✔ No se almacenan credenciales en el código
✔ Conexión segura SSL


Endpoints disponibles
🔹 GET /
  Endpoint de verificación del servicio.
  
GET /forecast/sensores

Endpoint principal de predicción.

Genera predicciones para los sensores:

  Temperatura
  
  Humedad
  
  Calidad de aire (MQ135)

Flujo interno:
  
  Consulta datos históricos desde PostgreSQL
  
  Prepara los datos en formato Prophet (ds, y)
  
  Entrena un modelo por sensor
  
  Predice valores futuros
  
  Devuelve resultados en formato JSON

Ejemplo de respuesta:
{
  "ok": true,
  "prediccion": {
    "temp": [
      {
        "ds": "2025-12-10T10:30:00",
        "yhat": 22.5,
        "yhat_lower": 21.9,
        "yhat_upper": 23.1
      }
    ],
    "hum": [],
    "mq135": []
  }
}


Modelo de predicción (Prophet)

Para cada sensor:

Se entrena un modelo independiente

Se utilizan los campos:

ds: timestamp

y: valor del sensor

Configuración de predicción:

futuro = modelo.make_future_dataframe(
    periods=30,
    freq="min"
)
Predicción de 30 minutos hacia el futuro
✔ Intervalos de confianza incluidos (yhat_lower, yhat_upper)
