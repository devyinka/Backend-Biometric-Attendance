import http from "http";
import "dotenv/config";
import { app } from "./config/app/app";
import { faceService } from "./services/faceService";
import { initializeWebSocket } from "./config/socket/websocket";

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);

initializeWebSocket(server);
app.set("io", server);
faceService
  .loadModels()
  .then(() => {
    console.log("Face detection model loaded successfully");
  })
  .catch((error) => {
    console.error("Error loading face detection model:", error);
  });
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
