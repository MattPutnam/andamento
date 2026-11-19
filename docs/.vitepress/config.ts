import { existsSync, readFileSync } from "node:fs";
import { defineConfig, type DefaultTheme } from "vitepress";

// Made by TypeDoc (`npm run api`) before the site builds.
const apiSidebarFile = new URL("../reference/api/typedoc-sidebar.json", import.meta.url);
const apiSidebar: DefaultTheme.SidebarItem[] = existsSync(apiSidebarFile) ? JSON.parse(readFileSync(apiSidebarFile, "utf8")) : [];

const repo = "https://github.com/MattPutnam/andamento";
const site = "https://mattputnam.github.io/andamento";

export default defineConfig({
  title: "Andamento",
  description: "Tiling layouts with any content: photo walls, galleries, mosaics and patterned backgrounds.",
  base: "/andamento/",
  cleanUrls: true,
  lastUpdated: false,
  head: [["link", { rel: "icon", type: "image/svg+xml", href: "/andamento/logo.svg" }]],
  // The packages' own options use `__VUE_*` flags; VitePress sets them itself.
  vite: { ssr: { noExternal: ["@andamento/vue", "@andamento/dom"] } },
  markdown: { theme: { light: "github-light", dark: "github-dark" } },
  themeConfig: {
    logo: "/logo.svg",
    nav: [
      { text: "Guide", link: "/guide/", activeMatch: "/guide/" },
      { text: "Examples", link: "/examples/" },
      { text: "Patterns", link: "/guide/patterns" },
      { text: "API", link: "/reference/", activeMatch: "/reference/" },
      { text: "Playground", link: `${site}/playground/`, target: "_self" },
    ],
    sidebar: {
      "/reference/": [
        { text: "API reference", items: [{ text: "Overview", link: "/reference/" }] },
        ...apiSidebar.map((m) => ({ ...m, collapsed: m.text !== "@andamento/core" })),
      ],
      "/": [
        {
          text: "Introduction",
          items: [
            { text: "What is Andamento?", link: "/guide/" },
            { text: "Getting started", link: "/guide/getting-started" },
            { text: "Layouts and cells", link: "/guide/concepts" },
          ],
        },
        {
          text: "Shaping the layout",
          items: [
            { text: "Patterns", link: "/guide/patterns" },
            { text: "Layout options", link: "/guide/layout-options" },
            { text: "Regions, holes and edges", link: "/guide/regions" },
            { text: "Featured tiles and weights", link: "/guide/featured" },
            { text: "Tile size by density", link: "/guide/density" },
            { text: "Andamento flow", link: "/guide/flow" },
            { text: "Your own tilings", link: "/guide/custom-tilings" },
          ],
        },
        {
          text: "Filling the tiles",
          items: [
            { text: "Placing content", link: "/guide/content" },
            { text: "Fitting photos", link: "/guide/photos" },
            { text: "Colour, pictures and relief", link: "/guide/styling" },
          ],
        },
        {
          text: "Interaction",
          items: [
            { text: "Keyboard and accessibility", link: "/guide/accessibility" },
            { text: "Animated transitions", link: "/guide/animation" },
            { text: "Virtualisation", link: "/guide/virtualization" },
            { text: "Hit testing", link: "/guide/hit-testing" },
          ],
        },
        {
          text: "Renderers",
          items: [
            { text: "React", link: "/frameworks/react" },
            { text: "Vue", link: "/frameworks/vue" },
            { text: "Web component", link: "/frameworks/web-component" },
            { text: "Plain DOM", link: "/frameworks/dom" },
            { text: "SVG, canvas and PNG", link: "/frameworks/svg-canvas" },
            { text: "Other frameworks", link: "/frameworks/other" },
          ],
        },
        {
          text: "More",
          items: [
            { text: "Examples", link: "/examples/" },
            { text: "API reference", link: "/reference/" },
            { text: "Limitations", link: "/guide/limitations" },
            { text: "Playground", link: `${site}/playground/`, target: "_self" },
          ],
        },
      ],
    },
    socialLinks: [{ icon: "github", link: repo }],
    search: { provider: "local" },
    outline: { level: [2, 3] },
    editLink: { pattern: `${repo}/edit/main/docs/:path`, text: "Edit this page on GitHub" },
    footer: {
      message: "Hat tiling and isohedral tilings after Craig S. Kaplan's hatviz and Tactile (BSD 3-Clause).",
    },
  },
});
