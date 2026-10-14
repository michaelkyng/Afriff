/** Asks the Ops API who is signed in on this device, before the first guarded route. */
export default defineNuxtPlugin({
  name: 'auth',
  dependsOn: ['ops'],
  async setup() {
    await useStaff().restore()
  },
})
