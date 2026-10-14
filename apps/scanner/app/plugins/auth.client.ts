/** Asks the door API who is signed in on this device, before the first guarded route. */
export default defineNuxtPlugin({
  name: 'auth',
  dependsOn: ['door'],
  async setup() {
    await useStaff().restore()
  },
})
