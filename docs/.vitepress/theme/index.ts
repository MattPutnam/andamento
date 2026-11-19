import DefaultTheme from "vitepress/theme";
import type { Theme } from "vitepress";
import Figure from "./Figure.vue";
import Figures from "./Figures.vue";
import PatternGallery from "./PatternGallery.vue";
import LiveDemo from "./LiveDemo.vue";
import "./style.css";

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component("Figure", Figure);
    app.component("Figures", Figures);
    app.component("PatternGallery", PatternGallery);
    app.component("LiveDemo", LiveDemo);
  },
} satisfies Theme;
