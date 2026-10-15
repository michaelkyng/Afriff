/**
 * Keeps push in step once the app has started: refreshes this device's token
 * and reminders on the server, follows reminder changes, and moves the app to
 * wherever a tapped notification points (`public/push-sw.js` asks).
 */
export default defineNuxtPlugin({
  name: 'push',
  dependsOn: ['api', 'auth'],
  setup() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        const path = event.data?.type === 'afriff:open' ? event.data.path : null
        if (typeof path === 'string' && path.startsWith('/') && !path.startsWith('//')) navigateTo(path)
      })
    }

    if (!useNuxtApp().$push) return
    const push = usePush()
    const reminders = useRemindersStore()
    push.sync()
    watchDebounced(() => reminders.keys, () => push.active.value && push.sync(), { debounce: 1500 })
  },
})
