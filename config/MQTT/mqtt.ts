import mqtt from "mqtt";
import dotenv from "dotenv";
dotenv.config();

const clientId = `kiosk_backend_${Math.random().toString(16).slice(3)}`;

const mqttOptions = {
  clientId: clientId,
  username: process.env.MQTTBROKER_USERNAME,
  password: process.env.MQTTBROKER_PASSWORD,
};

export const mqttClient = mqtt.connect(
  process.env.MQTT_BROKER_URL as string,
  mqttOptions,
);

mqttClient.on("connect", () => {
  console.log(" Connected to MQTT Broker (HiveMQ)");
});

mqttClient.on("error", (error) => {
  console.error(" MQTT Connection Error:", error.message);
});

mqttClient.on("offline", () => {
  console.warn("MQTT Client is offline. Check your internet or URL.");
});

//Log when it attempts to reconnect
mqttClient.on("reconnect", () => {
  console.log("🔄 Attempting to reconnect to MQTT Broker...");
});
