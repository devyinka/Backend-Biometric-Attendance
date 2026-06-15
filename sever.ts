import http from "http";
import "dotenv/config";
import { app } from "./config/app/app";
import { initializeWebSocket } from "./config/socket/websocket";

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);

initializeWebSocket(server);
app.set("io", server);

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
