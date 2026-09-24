import { afterAll, expect, test } from 'bun:test'
import { authRedirect, isAuthRoute } from '../app/utils/auth.ts'

const originalGlobals = Object.fromEntries(
  ['defineNuxtRouteMiddleware', 'useSessionStore', 'navigateTo', 'isAuthRoute'].map(key => [key, globalThis[key]]),
)
let signedIn = false
globalThis.defineNuxtRouteMiddleware = handler => handler
globalThis.useSessionStore = () => ({ isSignedIn: signedIn })
globalThis.navigateTo = (location, options) => ({ location, options })
globalThis.isAuthRoute = isAuthRoute
const { default: guard } = await import('../app/middleware/auth.global.ts')

afterAll(() => {
  for (const [key, value] of Object.entries(originalGlobals)) {
    if (value === undefined) delete globalThis[key]
    else globalThis[key] = value
  }
})

test('all app routes, including future routes, require a session and preserve the destination', () => {
  signedIn = false
  for (const path of ['/', '/programme', '/me', '/tickets/123', '/checkout', '/styleguide', '/future-page']) {
    const fullPath = `${path}?filter=saved#details`
    expect(guard({ path, fullPath })).toEqual({
      location: { path: '/signin', query: { redirect: fullPath } },
      options: { replace: true },
    })
  }
})

test('sign-in, signup and recovery remain accessible without a session', () => {
  signedIn = false
  for (const path of ['/signin', '/signup', '/reset-pin', '/signin/', '/SIGNIN']) {
    expect(guard({ path, fullPath: path })).toBeUndefined()
  }
  expect(isAuthRoute('/signin/anything')).toBe(false)
})

test('signed-in attendees can access protected routes', () => {
  signedIn = true
  expect(guard({ path: '/programme', fullPath: '/programme' })).toBeUndefined()
})

test('return destinations preserve deep links but reject external URLs and auth loops', () => {
  expect(authRedirect('/programme?day=3#films')).toBe('/programme?day=3#films')
  for (const target of [undefined, ['/', '/me'], 'https://example.com', '//example.com', '/\\example.com', '/signin', '/signup?redirect=/signin', '/reset-pin/', '/me/../signin']) {
    expect(authRedirect(target)).toBe('/')
  }
})
