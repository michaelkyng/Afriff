// AFRIFF Door: the ticket scanner for festival staff.
// SPA mode, dark only (lobbies are dim, and dark is kinder to a battery that has
// to last a festival day), installable so it opens full screen from the home screen.
export default defineNuxtConfig({
  extends: ['@afriff/ui-kit'],
  compatibilityDate: '2026-09-01',
  ssr: false,
  devtools: { enabled: false },

  modules: ['@vueuse/nuxt', '@vite-pwa/nuxt'],

  css: ['~/assets/css/main.css'],

  components: [{ path: '~/components', pathPrefix: false, extensions: ['vue'] }],

  app: {
    pageTransition: { name: 'page', mode: 'out-in' },
    head: {
      htmlAttrs: { lang: 'en', 'data-theme': 'dark' },
      title: 'AFRIFF Door',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'description', content: 'Ticket scanning for AFRIFF festival staff.' },
        { name: 'robots', content: 'noindex' },
        { name: 'theme-color', content: '#060A26' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
        { name: 'apple-mobile-web-app-title', content: 'AFRIFF Door' },
      ],
      link: [
        { rel: 'icon', href: '/favicon.ico', sizes: '48x48' },
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      ],
    },
  },

  runtimeConfig: {
    public: {
      // 'mock' (the demo door) or 'firebase'. See .env.example.
      apiMode: 'mock',
      mockLatency: 250,
      firebase: {
        apiKey: '',
        authDomain: '',
        projectId: '',
        appId: '',
        functionsRegion: 'europe-west1',
        emulatorHost: '',
      },
    },
  },

  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      id: '/',
      name: 'AFRIFF Door',
      short_name: 'AFRIFF Door',
      description: 'Ticket scanning for AFRIFF festival staff.',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      orientation: 'portrait',
      background_color: '#060A26',
      theme_color: '#060A26',
      icons: [
        { src: '/pwa-64x64.png', sizes: '64x64', type: 'image/png' },
        { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        { src: '/maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: {
      navigateFallback: '/',
      globPatterns: ['**/*.{js,css,html,png,webp,svg,ico,woff2,webmanifest}'],
      globIgnores: ['200.html', '404.html', '*/**/index.html', '**/*-cyrillic*', '**/*-greek*'],
      cleanupOutdatedCaches: true,
    },
    devOptions: { enabled: false },
  },
})
