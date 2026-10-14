/**
 * Asks the API adapter who is signed in before the first guarded route runs,
 * then follows any change it reports later: signed out in another tab, or a
 * session ended by a password reset elsewhere. `app.vue` takes the attendee to
 * sign in when the session goes.
 */
export default defineNuxtPlugin({
  name: 'auth',
  dependsOn: ['api'],
  async setup() {
    const auth = useAuth()
    await auth.restore()
    auth.follow()
  },
})
