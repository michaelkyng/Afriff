/**
 * Guards the pages that need an account (checkout today).
 * Sends guests to sign in and back to where they were heading.
 */
export default defineNuxtRouteMiddleware((to) => {
  if (useSessionStore().isSignedIn) return
  return navigateTo({ path: '/signin', query: { redirect: to.fullPath } })
})
