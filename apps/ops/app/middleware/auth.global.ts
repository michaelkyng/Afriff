/** Everything but sign-in is for ops and admin staff. */
export default defineNuxtRouteMiddleware((to) => {
  const { staff } = useStaff()
  if (to.path === '/signin') return staff.value ? navigateTo('/', { replace: true }) : undefined
  if (!staff.value) return navigateTo({ path: '/signin', query: { redirect: to.fullPath } }, { replace: true })
})
