import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const clientRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: clientRoot,
  publicDir: path.resolve(clientRoot, "public"),
  build: {
    outDir: path.resolve(clientRoot, "../dist"),
    emptyOutDir: true,
  },
});
