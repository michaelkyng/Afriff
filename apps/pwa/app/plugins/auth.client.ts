/**
 * Restores the persisted session into the API adapter before the first guarded
 * route runs, and drops it if the mock server no longer knows the token
 * (for example after "Reset demo data").
 */
export default defineNuxtPlugin({
  name: 'auth',
  dependsOn: ['api'],
  async setup() {
    await useAuth().restore()
  },
})
