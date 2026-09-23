import { describe, expect, test } from 'bun:test'
import { createMockApi } from '@afriff/api/mock'

/** A fresh adapter per test: accounts and sessions live inside the adapter instance. */
const newApi = () => createMockApi({ latency: 0 })

const PIN = '481902'
/** Any six digits pass while there is no mail integration, so the code itself is arbitrary. */
const ANY_CODE = '314159'

async function signUp(api, { email = 'ada@example.com', name = 'Ada Okoye', pin = PIN } = {}) {
  await api.auth.requestCode({ email, purpose: 'signup' })
  const ticket = await api.auth.verifyCode({ email, code: ANY_CODE })
  return api.auth.setPin({ ticket: ticket.token, pin, name })
}

describe('mock sign-up', () => {
  test('issues a six-digit code for a new email', async () => {
    const api = newApi()
    const challenge = await api.auth.requestCode({ email: '  Ada@Example.com ', purpose: 'signup' })
    expect(challenge.email).toBe('ada@example.com')
    expect(challenge.purpose).toBe('signup')
    expect(challenge.devCode).toMatch(/^\d{6}$/)
    expect(Date.parse(challenge.expiresAt)).toBeGreaterThan(Date.now())
  })

  test('rejects an invalid email address', async () => {
    await expect(newApi().auth.requestCode({ email: 'not-an-email', purpose: 'signup' }))
      .rejects.toMatchObject({ name: 'ApiError', code: 'validation' })
  })

  test('takes any six-digit code, but still insists on six digits', async () => {
    const api = newApi()
    await api.auth.requestCode({ email: 'ada@example.com', purpose: 'signup' })
    await expect(api.auth.verifyCode({ email: 'ada@example.com', code: '12345' }))
      .rejects.toMatchObject({ code: 'validation' })
    const ticket = await api.auth.verifyCode({ email: 'ada@example.com', code: '000000' })
    expect(ticket.token).toMatch(/^vrf_/)
    expect(ticket).toMatchObject({ email: 'ada@example.com', purpose: 'signup' })
    expect(ticket.name).toBeUndefined()
  })

  test('will not verify a code that was never asked for', async () => {
    await expect(newApi().auth.verifyCode({ email: 'ada@example.com', code: ANY_CODE }))
      .rejects.toMatchObject({ code: 'unauthorized' })
  })

  test('creates the account and signs it in with the new PIN', async () => {
    const api = newApi()
    const session = await signUp(api)
    expect(session.token).toMatch(/^ses_/)
    expect(session.user).toMatchObject({ email: 'ada@example.com', name: 'Ada Okoye' })
    expect(await api.auth.me()).toMatchObject({ id: session.user.id })
  })

  test('needs a name, and a PIN that is not an obvious guess', async () => {
    const api = newApi()
    await api.auth.requestCode({ email: 'ada@example.com', purpose: 'signup' })
    const { token } = await api.auth.verifyCode({ email: 'ada@example.com', code: ANY_CODE })

    for (const pin of ['111111', '123456', '654321', '1234']) {
      await expect(api.auth.setPin({ ticket: token, pin, name: 'Ada Okoye' }))
        .rejects.toMatchObject({ code: 'validation', details: { field: 'pin' } })
    }
    await expect(api.auth.setPin({ ticket: token, pin: PIN }))
      .rejects.toMatchObject({ code: 'validation', details: { field: 'name' } })
  })

  test('a verification ticket works only once', async () => {
    const api = newApi()
    const { user } = await signUp(api)
    expect(user.email).toBe('ada@example.com')

    await api.auth.requestCode({ email: 'zainab@example.com', purpose: 'signup' })
    const { token } = await api.auth.verifyCode({ email: 'zainab@example.com', code: ANY_CODE })
    await api.auth.setPin({ ticket: token, pin: PIN, name: 'Zainab Bello' })
    await expect(api.auth.setPin({ ticket: token, pin: '204815', name: 'Zainab Bello' }))
      .rejects.toMatchObject({ code: 'unauthorized' })
  })

  test('refuses an email that already has an account', async () => {
    const api = newApi()
    await signUp(api)
    await expect(api.auth.requestCode({ email: 'ada@example.com', purpose: 'signup' }))
      .rejects.toMatchObject({ code: 'conflict', details: { field: 'email' } })
  })

  test('keeps the PIN to itself', async () => {
    const api = newApi()
    const session = await signUp(api)
    for (const account of [session.user, await api.auth.me()]) {
      expect(account).not.toHaveProperty('pinHash')
      expect(account).not.toHaveProperty('pinSalt')
      expect(account).not.toHaveProperty('failedPins')
    }
  })
})

describe('mock sign-in', () => {
  test('signs in with the email and PIN, on a fresh session each time', async () => {
    const api = newApi()
    const first = await signUp(api)
    const second = await api.auth.signIn({ email: '  ADA@example.com ', pin: PIN })
    expect(second.user.id).toBe(first.user.id)
    expect(second.token).not.toBe(first.token)
  })

  test('says the same thing for a wrong PIN and for an email it does not know', async () => {
    const api = newApi()
    await signUp(api)
    const wrong = await api.auth.signIn({ email: 'ada@example.com', pin: '204815' }).catch((error) => error)
    const unknown = await api.auth.signIn({ email: 'nobody@example.com', pin: PIN }).catch((error) => error)
    expect(wrong).toMatchObject({ code: 'unauthorized', details: { field: 'pin' } })
    expect(unknown.message).toBe(wrong.message)
  })

  test('locks the account after five wrong PINs, then lets a reset back in', async () => {
    const api = newApi()
    await signUp(api)
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      await expect(api.auth.signIn({ email: 'ada@example.com', pin: '204815' }))
        .rejects.toMatchObject({ code: 'unauthorized' })
    }
    // The right PIN is refused too, until the lockout lapses.
    await expect(api.auth.signIn({ email: 'ada@example.com', pin: PIN }))
      .rejects.toMatchObject({ message: expect.stringContaining('Too many wrong PINs') })

    await api.auth.requestCode({ email: 'ada@example.com', purpose: 'reset' })
    const { token } = await api.auth.verifyCode({ email: 'ada@example.com', code: ANY_CODE })
    await api.auth.setPin({ ticket: token, pin: '730264' })
    expect(await api.auth.signIn({ email: 'ada@example.com', pin: '730264' })).toMatchObject({
      user: { email: 'ada@example.com' },
    })
  })
})

describe('mock PIN reset', () => {
  test('refuses an email with no account, and carries the name back for one that has', async () => {
    const api = newApi()
    await expect(api.auth.requestCode({ email: 'ada@example.com', purpose: 'reset' }))
      .rejects.toMatchObject({ code: 'not_found', details: { field: 'email' } })

    await signUp(api)
    const challenge = await api.auth.requestCode({ email: 'ada@example.com', purpose: 'reset' })
    expect(challenge.purpose).toBe('reset')
    const ticket = await api.auth.verifyCode({ email: 'ada@example.com', code: ANY_CODE })
    expect(ticket).toMatchObject({ purpose: 'reset', name: 'Ada Okoye' })
  })

  test('replaces the PIN and ends the sessions opened with the old one', async () => {
    const api = newApi()
    const old = await signUp(api)

    await api.auth.requestCode({ email: 'ada@example.com', purpose: 'reset' })
    const { token } = await api.auth.verifyCode({ email: 'ada@example.com', code: ANY_CODE })
    const fresh = await api.auth.setPin({ ticket: token, pin: '730264' })
    expect(fresh.user.id).toBe(old.user.id)

    await expect(api.auth.signIn({ email: 'ada@example.com', pin: PIN }))
      .rejects.toMatchObject({ code: 'unauthorized' })

    api.setAuthToken(old.token)
    await expect(api.auth.me()).rejects.toMatchObject({ code: 'unauthorized' })
    api.setAuthToken(fresh.token)
    expect(await api.auth.me()).toMatchObject({ id: old.user.id })
  })
})

describe('mock account', () => {
  test('needs a token for account calls, and drops it on sign out', async () => {
    const api = newApi()
    await expect(api.auth.me()).rejects.toMatchObject({ code: 'unauthorized' })
    await signUp(api)
    await api.auth.signOut()
    await expect(api.auth.me()).rejects.toMatchObject({ code: 'unauthorized' })

    const other = newApi()
    other.setAuthToken('ses_madeup')
    await expect(other.auth.me()).rejects.toMatchObject({ code: 'unauthorized' })
  })

  test('saves profile changes and validates the phone number', async () => {
    const api = newApi()
    await signUp(api)
    const updated = await api.auth.updateProfile({ name: 'Ada N. Okoye', phone: '0803 123 4567' })
    expect(updated).toMatchObject({ name: 'Ada N. Okoye', phone: '0803 123 4567' })
    expect(await api.auth.me()).toMatchObject({ phone: '0803 123 4567' })

    expect((await api.auth.updateProfile({ name: 'Ada N. Okoye', phone: '' })).phone).toBeUndefined()
    await expect(api.auth.updateProfile({ name: 'Ada', phone: '12' }))
      .rejects.toMatchObject({ code: 'validation' })
    await expect(api.auth.updateProfile({ name: 'A' }))
      .rejects.toMatchObject({ code: 'validation' })
  })

  test('returns copies, so the caller cannot edit the account in place', async () => {
    const api = newApi()
    const session = await signUp(api)
    session.user.name = 'Someone else'
    expect((await api.auth.me()).name).toBe('Ada Okoye')
  })
})
