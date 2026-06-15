import mqtt from "mqtt";
import dotenv from "dotenv";
dotenv.config();

const mqttOptions = {
  username: process.env.MQTTBROKER_USERNAME,
  password: process.env.MQTTBROKER_PASSWORD,
};
export const mqttClient = mqtt.connect(
  process.env.MQTT_BROKER_URL as string,
  mqttOptions,
);

mqttClient.on("connect", () => {
  console.log("Connected to MQTT Broker");
});
