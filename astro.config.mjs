import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

// GitHub Pages は https://motohiro-estride.github.io/engineer-skill-map/ で配信されるため、
// public ビルド時のみ base を repo 名に設定する。dev / build:local は root でそのまま動かす。
const isPublic = process.env.BUILD_MODE === "public";

export default defineConfig({
  site: "https://motohiro-estride.github.io",
  base: isPublic ? "/engineer-skill-map" : "/",
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
});
