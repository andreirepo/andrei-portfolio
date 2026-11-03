// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: "https://andreirepo.com/",

  markdown: {
    shikiConfig: {
      // github-dark's comment colour (#6a737d) only reaches 3.05:1 on its own
      // background; github-dark-default is the same family with every visible
      // token at 6.15:1 or better.
      theme: 'github-dark-default',
    },
  },

  vite: {
    plugins: [tailwindcss()]
  },

  integrations: [sitemap()]
});