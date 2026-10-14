/** Everything but sign-in is for signed-in staff. */
export default defineNuxtRouteMiddleware((to) => {
  const { staff } = useStaff()
  if (to.path === '/signin') return staff.value ? navigateTo('/', { replace: true }) : undefined
  if (!staff.value) return navigateTo('/signin', { replace: true })
})
