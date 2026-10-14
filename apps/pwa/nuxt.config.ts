// AFRIFF Attendee PWA.
// SPA mode (ssr: false) keeps everything in the browser so the app works offline:
// the mock API persists to localStorage, and the Firebase adapter keeps Firestore's
// cache and the session in IndexedDB. Public pages like film detail may later
// benefit from prerendering for SEO.
export default defineNuxtConfig({
  extends: ['@afriff/ui-kit'],
  compatibilityDate: '2026-09-01',
  ssr: false,
  devtools: { enabled: true },

  modules: [
    '@pinia/nuxt',
    'pinia-plugin-persistedstate/nuxt',
    '@vueuse/nuxt',
    '@vite-pwa/nuxt',
  ],

  css: ['~/assets/css/main.css'],

  // App and layer components retain their existing filename-based names.
  components: [{ path: '~/components', pathPrefix: false, extensions: ['vue'] }],

  app: {
    pageTransition: { name: 'page', mode: 'out-in' },
    head: {
      htmlAttrs: { lang: 'en' },
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'description', content: 'Programme, passes and tickets for the Africa International Film Festival.' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
        { name: 'apple-mobile-web-app-title', content: 'AFRIFF' },
      ],
      link: [
        { rel: 'icon', href: '/favicon.ico', sizes: '48x48' },
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      ],
      script: [
        {
          // Apply the saved theme before first paint to avoid a light/dark flash.
          // Reads the persisted prefs store (key `afriff:prefs`).
          innerHTML: `(function(){var t='dark';try{var p=JSON.parse(localStorage.getItem('afriff:prefs')||'{}');t=p.theme||'system';if(t==='system'){t=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'}}catch(e){}document.documentElement.setAttribute('data-theme',t)})()`,
          tagPosition: 'head',
        },
      ],
    },
  },

  // Public settings reach the browser, and a static build bakes them in at
  // `generate` time: rebuild after changing them. See .env.example.
  runtimeConfig: {
    public: {
      // 'mock' runs entirely in the browser on placeholder data. 'firebase' uses
      // Firebase Auth, Firestore and Cloud Functions, with Paystack for payment.
      apiMode: 'mock',
      // Simulated network latency for the mock API, in ms (0 to disable).
      mockLatency: 450,
      // Where links in account emails lead back to. Defaults to wherever the app is served from.
      appUrl: '',
      // The Firebase web config. None of it is secret; the security rules are what protect the data.
      firebase: {
        apiKey: '',
        authDomain: '',
        projectId: '',
        appId: '',
        functionsRegion: 'europe-west1',
        // e.g. 127.0.0.1 to use the local Emulator Suite (`bun run emulators`).
        emulatorHost: '',
      },
    },
  },

  piniaPluginPersistedstate: {
    storage: 'localStorage',
    key: 'afriff:%id',
  },

  pwa: {
    registerType: 'prompt',
    manifest: {
      id: '/',
      name: 'AFRIFF · Africa International Film Festival',
      short_name: 'AFRIFF',
      description: 'Programme, passes and tickets for the Africa International Film Festival.',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      orientation: 'portrait',
      background_color: '#060A26',
      theme_color: '#060A26',
      categories: ['entertainment', 'events'],
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
      globIgnores: [
        // SPA mode: every route's HTML is the same shell, so only the root index.html is
        // precached and navigateFallback serves it for all routes.
        '200.html',
        '404.html',
        '*/**/index.html',
        // Skip font subsets the app doesn't need offline (Vietnamese stays: it covers Yoruba ẹ/ọ).
        '**/*-cyrillic*',
        '**/*-greek*',
      ],
      cleanupOutdatedCaches: true,
    },
    client: {
      installPrompt: true,
      periodicSyncForUpdates: 60 * 60,
    },
    devOptions: {
      // Flip to true to debug the service worker during `bun run dev`.
      enabled: false,
      type: 'module',
      navigateFallback: '/',
    },
  },
})
