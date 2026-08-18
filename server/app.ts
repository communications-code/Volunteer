import express, { type NextFunction, type Request, type Response } from "express";
import { createServer } from "http";
import { registerRoutes } from "./routes";
import { formatTimeInNewYork } from "./timezone";

function log(message: string, source = "express") {
  const formattedTime = formatTimeInNewYork(new Date(), {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

function summarizeResponseForLog(body: unknown): string | null {
  if (body === undefined) return null;
  if (body === null) return "null";
  if (typeof body === "string") return body.length > 120 ? `${body.slice(0, 120)}...` : body;
  if (typeof body === "number" || typeof body === "boolean") return String(body);
  if (Array.isArray(body)) return `[array length=${body.length}]`;
  if (typeof body === "object") {
    const objectBody = body as Record<string, unknown>;
    const keys = Object.keys(objectBody);
    const preview = keys.slice(0, 6).join(",");
    const suffix = keys.length > 6 ? ",..." : "";
    return `{keys:${preview}${suffix}}`;
  }
  return null;
}

export interface CreateAppOptions {
  enableVite: boolean;
  serveBuiltClient: boolean;
}

export async function createApp(options: CreateAppOptions) {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: unknown;

    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };

    res.on("finish", () => {
      const duration = Date.now() - start;
      if (path.startsWith("/api")) {
        let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
        const responseSummary = summarizeResponseForLog(capturedJsonResponse);
        if (responseSummary) {
          logLine += ` :: ${responseSummary}`;
        }

        if (logLine.length > 200) {
          logLine = `${logLine.slice(0, 199)}...`;
        }

        log(logLine);
      }
    });

    next();
  });

  await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
  });

  const server = createServer(app);

  // Dynamically import vite module only when needed (not in serverless)
  if (options.enableVite || options.serveBuiltClient) {
    const { setupVite, serveStatic } = await import("./vite");
    if (options.enableVite) {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }
  }

  return { app, server };
}
