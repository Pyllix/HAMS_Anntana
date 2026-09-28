import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

interface VercelConfig {
  rewrites: Array<{ source: string; destination: string }>;
  headers?: Array<{
    source: string;
    headers: Array<{ key: string; value: string }>;
  }>;
}

const config = JSON.parse(
  readFileSync(new URL("../vercel.json", import.meta.url), "utf8"),
) as VercelConfig;

test("routes the API through the production backend before the SPA fallback", () => {
  assert.deepEqual(
    config.rewrites.map(({ source }) => source),
    ["/api/:path*", "/(.*)"],
  );
  assert.equal(
    new URL(config.rewrites[0].destination).host,
    "hams-anntana.onrender.com",
  );
});

test("prevents caching responses from the API proxy", () => {
  const apiHeaders = config.headers?.find(({ source }) => source === "/api/:path*");
  const cacheControl = apiHeaders?.headers.find(
    ({ key }) => key.toLowerCase() === "cache-control",
  )?.value;

  assert.match(cacheControl ?? "", /no-store/i);
});
