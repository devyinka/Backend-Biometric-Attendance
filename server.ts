import http from "http";
import "dotenv/config";
import * as util from "util";

// 1. Run the polyfill immediately at the top level
if (typeof (util as any).isNullOrUndefined !== "function") {
  (util as any).isNullOrUndefined = (obj: any) =>
    obj === null || obj === undefined;
}

// 2. Wrap your server startup in an async function
async function startServer() {
  try {
    // 3. Dynamically import your modules AFTER the polyfill has run.
    // This completely bypasses TypeScript's import hoisting.
    const { app } = await import("./config/app/app");
    const { faceService } = await import("./services/faceService");
    const { initializeWebSocket } = await import("./config/socket/websocket");

    const PORT = process.env.PORT || 3000;
    const server = http.createServer(app);

    initializeWebSocket(server);
    app.set("io", server);

    await faceService.loadModels();
    console.log("Face detection model loaded successfully");

    server.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server or load face models:", error);
  }
}

// 4. Start the app
startServer();
