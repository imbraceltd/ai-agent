import { defineConfig } from "tsup";
import { cpSync, existsSync } from "node:fs";
import { resolve } from "node:path";

export default defineConfig({
  // index.ts is the server. database/migrate.ts is the standalone migration
  // runner invoked at deploy time (node dist/database/migrate.js). The entry
  // key preserves the "database/" subpath so the compiled output and the
  // migrations folder it resolves (dist/database/migrations) stay colocated.
  entry: {
    index: "src/index.ts",
    "database/migrate": "src/database/migrate.ts",
  },
  outDir: "dist",
  format: ["cjs"],
  target: "es2022",
  sourcemap: true,
  clean: true,
  splitting: false,
  // Externalize native DuckDB bindings so dynamic import() stays lazy at runtime
  external: ["@duckdb/node-api", "@duckdb/node-bindings"],
  // Resolve @/* path aliases and inline .txt/.md files as strings
  esbuildOptions(options) {
    options.alias = {
      "@": "./src",
    };
    options.loader = {
      ...options.loader,
      ".txt": "text",
      ".md": "text",
    };
  },
  // Copy non-code assets (PDF guides, etc.) into dist so they ship with the build.
  // esbuild/tsup do not move binary assets by default — this mirrors
  // src/assets → dist/assets after a successful compile.
  onSuccess: async () => {
    const src = resolve(__dirname, "src/assets");
    const dst = resolve(__dirname, "dist/assets");
    if (existsSync(src)) {
      cpSync(src, dst, { recursive: true });
    }
    // Ship the SQL migrations alongside the compiled runner so
    // `node dist/database/migrate.js` can apply them in the prod image.
    const migSrc = resolve(__dirname, "src/database/migrations");
    const migDst = resolve(__dirname, "dist/database/migrations");
    if (existsSync(migSrc)) {
      cpSync(migSrc, migDst, { recursive: true });
    }
  },
});
