import { execSync } from "child_process";
import { unlinkSync } from "fs";

// Bundle the API handler with esbuild
execSync(
  'npx esbuild "api/[...route].ts" --platform=node --packages=external --bundle --format=esm --outfile="api/[...route].js" --alias:@shared=./shared',
  { stdio: "inherit" }
);

// Remove the .ts source so Vercel uses the bundled .js
unlinkSync("api/[...route].ts");
