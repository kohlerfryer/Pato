import { defineConfig } from "vite";

/** The commit the page was built from, shown on the page so a tester can tell builds apart. */
const build = process.env.GITHUB_SHA?.slice(0, 7) ?? "dev";

export default defineConfig({
  // Relative paths, so the site works under any address GitHub Pages gives it.
  base: "./",
  plugins: [
    {
      name: "build-id",
      transformIndexHtml: (html) => html.replaceAll("__BUILD__", build),
    },
  ],
});
