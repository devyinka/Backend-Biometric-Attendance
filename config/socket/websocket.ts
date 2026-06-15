import type { Server as HttpServer } from "http";
import { Server as SocketIOServer } from "socket.io";

export let io: SocketIOServer;

export const initializeWebSocket = (httpServer: HttpServer) => {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log("A client connected:", socket.id);

    socket.on("disconnect", () => {
      console.log("A client disconnected:", socket.id);
    });
  });
};
