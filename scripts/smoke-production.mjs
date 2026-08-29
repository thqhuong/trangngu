/* global AbortSignal, fetch */
import console from "node:console";
import process from "node:process";
import { URL } from "node:url";

const rawUrl = process.argv[2] ?? process.env.TRANGNGU_URL;

if (!rawUrl) {
  console.error("Usage: node scripts/smoke-production.mjs https://SERVICE_URL");
  process.exit(2);
}

const serviceUrl = new URL(rawUrl);
if (serviceUrl.protocol !== "https:" && serviceUrl.hostname !== "localhost") {
  console.error("Refusing to test a non-HTTPS remote URL.");
  process.exit(2);
}

async function assertResponse(path, check) {
  const response = await fetch(new URL(path, serviceUrl), {
    redirect: "follow",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new Error(`${path} returned HTTP ${response.status}`);
  }
  await check(response);
  console.log(`PASS ${path} (${response.status})`);
}

try {
  await assertResponse("/", async (response) => {
    const body = await response.text();
    if (!body.includes("TrangNgữ")) throw new Error("Homepage does not contain TrangNgữ");
  });
  await assertResponse("/api/health", async (response) => {
    const body = await response.json();
    if (body.status !== "ok") throw new Error("Health response is not { status: 'ok' }");
  });
  console.log("Public shell and health endpoint passed. Run a real PDF translation separately.");
} catch (error) {
  console.error(`FAIL ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
