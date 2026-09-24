/** The only routes available before signing in. */
export function isAuthRoute(path: string): boolean {
  return /^\/(signin|signup|reset-pin)\/?$/i.test(path)
}

/** Keep return destinations inside the app and out of authentication loops. */
export function authRedirect(target: unknown): string {
  if (typeof target !== 'string' || !target.startsWith('/') || target.startsWith('//') || /[\\\s]/.test(target)) return '/'
  const url = new URL(target, 'https://afriff.local')
  return isAuthRoute(url.pathname) ? '/' : `${url.pathname}${url.search}${url.hash}`
}
