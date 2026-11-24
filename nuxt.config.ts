// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  // SPA mode: no server rendering, the app is fully hydrated on the client

  modules: [
    '@nuxt/eslint',
    '@nuxt/ui'
  ],
  ssr: false,

  devtools: {
    enabled: true
  },

  // GitHub Pages project sites live under /<repo>/, override with NUXT_APP_BASE_URL
  app: {
    baseURL: process.env.NUXT_APP_BASE_URL ?? '/'
  },

  css: ['~/assets/css/main.css'],

  ui: {
    eslint: {
      rules: {
        'no-unknown-classes': 'error',
        'no-conflicting-classes': 'error',
        'no-palette-colors': 'error'
      }
    }
  },

  routeRules: {
    '/': { prerender: true }
  },

  future: {
    compatibilityVersion: 5
  },

  compatibilityDate: '2026-06-30',

  // Static output only (`.output/public`), deployable to any static host / CDN
  nitro: {
    preset: 'static'
  },

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  }
})
