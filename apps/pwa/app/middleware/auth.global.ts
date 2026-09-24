/**
 * Requires an account for every page except the authentication flow.
 * Sends guests to sign in and back to where they were heading.
 */
export default defineNuxtRouteMiddleware((to) => {
  if (isAuthRoute(to.path) || useSessionStore().isSignedIn) return
  return navigateTo({ path: '/signin', query: { redirect: to.fullPath } }, { replace: true })
})
