import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { localYoucamPlugin } from "./server/local-youcam.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, "");
  const apiTarget = (env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
  const youcamKey = (env.YOUCAM_API_KEY ?? "").trim();
  const youcamServer =
    env.YOUCAM_API_SERVER?.trim() || "https://yce-api-01.makeupar.com";
  const localYoucam = youcamKey.length > 8;

  return {
    plugins: [
      react(),
      tailwindcss(),
      ...(localYoucam
        ? [localYoucamPlugin({ apiKey: youcamKey, apiServer: youcamServer })]
        : []),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: [
          "favicon.png",
          "logo.png",
          "og-girlcode360.png",
          "push-handler.js",
        ],
        workbox: {
          importScripts: ["/push-handler.js"],
        },
        manifest: {
          name: "GirlCode360",
          short_name: "GirlCode360",
          description: "Women's health & wellness companion",
          theme_color: "#fbf4f7",
          background_color: "#fbf4f7",
          display: "standalone",
          start_url: "/app",
          icons: [
            {
              src: "pwa-192.png",
              sizes: "192x192",
              type: "image/png",
            },
            {
              src: "pwa-512.png",
              sizes: "512x512",
              type: "image/png",
            },
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    define: {
      global: "globalThis",
      "import.meta.env.VITE_LOCAL_YOUCAM": JSON.stringify(
        localYoucam ? "true" : "false",
      ),
    },
    server: {
      port: 5173,
      proxy:
        apiTarget && !localYoucam
          ? {
              "/v1": {
                target: apiTarget,
                changeOrigin: true,
              },
            }
          : undefined,
    },
  };
});
