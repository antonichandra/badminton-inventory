import { execSync } from "node:child_process";

const vercelEnv = process.env.VERCEL_ENV ?? "unknown";
const isProduction = vercelEnv === "production";

if (isProduction) {
  console.log(
    "[vercel-build] Production: deploying Convex backend + building frontend",
  );
  execSync("npx convex deploy --cmd 'npm run build'", { stdio: "inherit" });
} else {
  console.log(
    `[vercel-build] ${vercelEnv}: building frontend only (skipping Convex deploy)`,
  );
  execSync("npm run build", { stdio: "inherit" });
}
