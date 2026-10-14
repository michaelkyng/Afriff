// AFRIFF Ops Console: the festival team's back office.
// SPA mode, desktop first. Follows the system's light or dark setting, since it
// is used at desks through the day rather than in a dark lobby.
export default defineNuxtConfig({
  extends: ['@afriff/ui-kit'],
  compatibilityDate: '2026-09-01',
  ssr: false,
  devtools: { enabled: false },

  modules: ['@vueuse/nuxt'],

  css: ['~/assets/css/main.css'],

  components: [{ path: '~/components', pathPrefix: false, extensions: ['vue'] }],

  app: {
    pageTransition: { name: 'page', mode: 'out-in' },
    head: {
      htmlAttrs: { lang: 'en' },
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'robots', content: 'noindex' },
      ],
      link: [
        { rel: 'icon', href: '/favicon.ico', sizes: '48x48' },
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
      ],
      script: [
        {
          // The system theme before first paint, so there is no flash.
          innerHTML: `document.documentElement.setAttribute('data-theme',matchMedia('(prefers-color-scheme: light)').matches?'light':'dark')`,
          tagPosition: 'head',
        },
      ],
    },
  },

  runtimeConfig: {
    public: {
      apiMode: 'mock',
      mockLatency: 200,
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
})
