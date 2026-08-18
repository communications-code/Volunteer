import "dotenv/config";
import { createApp } from "./app";

const appPromise = createApp({
  enableVite: false,
  serveBuiltClient: false,
});

export default async function handler(req: any, res: any) {
  const { app } = await appPromise;
  return app(req, res);
}
