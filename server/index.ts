import "dotenv/config";
import { createApp } from "./app";

(async () => {
  const isDev = process.env.NODE_ENV !== "production";
  const { server } = await createApp({
    enableVite: isDev,
    serveBuiltClient: !isDev,
  });

  const port = Number(process.env.PORT ?? 5000);
  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      console.log(`serving on port ${port}`);
    },
  );
})();
