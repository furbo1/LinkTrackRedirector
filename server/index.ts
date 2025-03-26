import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import cookieParser from "cookie-parser";

console.log("Starting server initialization...");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

console.log("Middleware configured...");

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

console.log("Logger middleware configured...");

// IIFE to handle async server startup
(async () => {
  try {
    console.log("Starting server setup...");
    
    // Start the server immediately to meet the port availability check
    // ALWAYS serve the app on port 5000 - this serves both API and client
    const port = 5000;
    
    console.log("About to register routes...");
    const server = await registerRoutes(app);
    console.log("Routes registered successfully");
    
    // Start listening immediately
    server.listen({
      port,
      host: "0.0.0.0",
    }, () => {
      log(`Server is running on port ${port}`);
    });
    console.log("Server listen called");

    // Add error handler for the server
    server.on('error', (err) => {
      console.error('Server error:', err);
    });
    console.log("Server error handler added");

    // Setup the error handler after server is listening
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      res.status(status).json({ message });
      console.error("Server error:", err);
    });
    console.log("App error handler added");

    // Then, after the server is listening, setup Vite
    // This ensures the port is open before potentially slow Vite initialization
    if (app.get("env") === "development") {
      log("Setting up Vite...");
      console.log("About to setup Vite...");
      try {
        await setupVite(app, server);
        console.log("Vite setup completed successfully");
      } catch (err) {
        console.error("Vite setup error (non-fatal):", err);
      }
    } else {
      serveStatic(app);
      console.log("Static assets served");
    }

    log("Server initialization complete");
  } catch (error) {
    // Catch any errors during startup
    console.error('Fatal error during server startup:', error);
    process.exit(1); // Exit with error code
  }
})().catch((err) => {
  console.error('Unhandled promise rejection during startup:', err);
  process.exit(1);
});
