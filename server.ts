import http from "http";
import "dotenv/config";
import * as util from "util";

/**
 * Compatibility patch for older dependencies that still expect
 * util.isNullOrUndefined(), which is not available in newer Node.js versions.
 *
 * This MUST happen before importing the rest of the application because
 * some dependencies may access this function while they are being loaded.
 */
if (typeof (util as any).isNullOrUndefined !== "function") {
  Object.defineProperty(util, "isNullOrUndefined", {
    value: (value: unknown) => value === null || value === undefined,
    writable: true,
    configurable: true,
  });
}

async function startServer() {
  try {
    console.log("Starting server...");

    // These imports are intentionally dynamic.
    // The util compatibility patch above must run first.
    const { app } = await import("./config/app/app");
    const { faceService } = await import("./services/faceService");
    const { initializeWebSocket } = await import("./config/socket/websocket");

    const PORT = Number(process.env.PORT) || 3000;

    const server = http.createServer(app);

    initializeWebSocket(server);

    app.set("io", server);

    console.log("Loading face detection models...");

    await faceService.loadModels();

    console.log("Face detection model loaded successfully");

    server.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error: unknown) {
    console.error("=================================");
    console.error("SERVER STARTUP ERROR");
    console.error("=================================");
    console.error(error);

    if (error instanceof Error) {
      console.error("Message:", error.message);
      console.error("Stack:", error.stack);
    }

    process.exit(1);
  }
}

startServer();
