import os
from flask import Flask, jsonify
from flask_cors import CORS
import pandas as pd
from prophet import Prophet
import psycopg2

app = Flask(__name__)   # <--- CORREGIDO
CORS(app)

DB_URL = os.environ.get("DATABASE_URL")   # <--- CORREGIDO

def get_conn():
    return psycopg2.connect(DB_URL, sslmode="require")

@app.route("/")
def home():
    return "Servicio IA con Prophet activo"

@app.route("/forecast/sensores")
def forecast_sensores():
    try:
        conn = get_conn()

        tablas = {
            "temp": "temperatura",
            "hum": "humedad",
            "mq135": "aire",
        }

        resultados = {}

        for clave, tabla in tablas.items():
            df = pd.read_sql_query(
                f"""
                SELECT timestamp AS ds, valor AS y
                FROM {tabla}
                ORDER BY timestamp ASC
                """,
                conn,
            )

            if len(df) < 5:
                resultados[clave] = []
                continue

            modelo = Prophet()
            modelo.fit(df[["ds", "y"]])

            futuro = modelo.make_future_dataframe(periods=30, freq="min")
            forecast = modelo.predict(futuro)

            recs = forecast[["ds", "yhat", "yhat_lower", "yhat_upper"]].tail(30)
            resultados[clave] = recs.to_dict("records")

        conn.close()
        return jsonify({ "ok": True, "prediccion": resultados })

    except Exception as e:
        print("Error en forecast_sensores:", e)
        return jsonify({ "ok": False, "error": str(e)}), 500

if __name__ == "__main__":
    PORT = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=PORT)
