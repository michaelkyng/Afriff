import { describe, expect, test } from 'bun:test'
import { confirmEmail, newApi, PASSWORD, signUp } from './helpers'

describe('mock sign-up', () => {
  test('creates the account, signs it in, and leaves the email to be confirmed', async () => {
    const api = newApi()
    const user = await signUp(api, { email: '  Ada@Example.com ' })
    expect(user).toMatchObject({
      email: 'ada@example.com',
      emailVerified: false,
      firstName: 'Ada',
      lastName: 'Okoye',
      name: 'Ada Okoye',
    })
    expect(await api.auth.me()).toMatchObject({ id: user.id })
    expect(await api.auth.restore()).toMatchObject({ id: user.id })
  })

  test('needs a valid email, a name and a password of at least eight characters', async () => {
    const api = newApi()
    const base = { email: 'ada@example.com', password: PASSWORD, firstName: 'Ada', lastName: 'Okoye' }
    await expect(api.auth.signUp({ ...base, email: 'not-an-email' }))
      .rejects.toMatchObject({ code: 'validation', details: { field: 'email' } })
    await expect(api.auth.signUp({ ...base, password: 'short' }))
      .rejects.toMatchObject({ code: 'validation', details: { field: 'password' } })
    await expect(api.auth.signUp({ ...base, lastName: '  ' }))
      .rejects.toMatchObject({ code: 'validation', details: { field: 'lastName' } })
  })

  test('refuses an email that already has an account', async () => {
    const api = newApi()
    await signUp(api)
    await expect(signUp(api, { email: 'ADA@example.com' }))
      .rejects.toMatchObject({ code: 'conflict', details: { field: 'email' } })
  })

  test('keeps the password to itself', async () => {
    const api = newApi()
    for (const account of [await signUp(api), await api.auth.me()]) {
      expect(account).not.toHaveProperty('passwordHash')
      expect(account).not.toHaveProperty('passwordSalt')
      expect(account).not.toHaveProperty('failedSignIns')
    }
  })
})

describe('mock sign-in', () => {
  test('signs in with the email and password, whatever the case of the email', async () => {
    const api = newApi()
    const created = await signUp(api)
    await api.auth.signOut()
    expect(await api.auth.restore()).toBeNull()
    const user = await api.auth.signIn({ email: '  ADA@example.com ', password: PASSWORD })
    expect(user.id).toBe(created.id)
  })

  test('says the same thing for a wrong password and for an email it does not know', async () => {
    const api = newApi()
    await signUp(api)
    await api.auth.signOut()
    const wrong = await api.auth.signIn({ email: 'ada@example.com', password: 'not the one' }).catch((error) => error)
    const unknown = await api.auth.signIn({ email: 'nobody@example.com', password: PASSWORD }).catch((error) => error)
    expect(wrong).toMatchObject({ code: 'unauthorized', details: { field: 'password' } })
    expect(unknown.message).toBe(wrong.message)
  })

  test('holds off after five wrong passwords, and a reset lets the attendee back in', async () => {
    const api = newApi()
    await signUp(api)
    await api.auth.signOut()
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      await expect(api.auth.signIn({ email: 'ada@example.com', password: 'not the one' }))
        .rejects.toMatchObject({ code: 'unauthorized' })
    }
    await expect(api.auth.signIn({ email: 'ada@example.com', password: 'not the one' }))
      .rejects.toMatchObject({ code: 'rate_limited' })
    // The right password is refused too, until the spell is over.
    await expect(api.auth.signIn({ email: 'ada@example.com', password: PASSWORD }))
      .rejects.toMatchObject({ code: 'rate_limited' })

    const { devCode } = await api.auth.requestPasswordReset({ email: 'ada@example.com' })
    await api.auth.resetPassword({ code: devCode, password: 'a new long phrase' })
    await api.auth.signOut()
    expect(await api.auth.signIn({ email: 'ada@example.com', password: 'a new long phrase' }))
      .toMatchObject({ email: 'ada@example.com' })
  })
})

describe('mock password reset', () => {
  test('answers the same way for an email with no account, without a link', async () => {
    const api = newApi()
    expect(await api.auth.requestPasswordReset({ email: 'Nobody@example.com' })).toEqual({ email: 'nobody@example.com' })
    await expect(api.auth.requestPasswordReset({ email: 'nope' })).rejects.toMatchObject({ code: 'validation' })
  })

  test('says whose account a link is for, then sets the password and signs in', async () => {
    const api = newApi()
    const created = await signUp(api)
    await api.auth.signOut()

    const { devCode } = await api.auth.requestPasswordReset({ email: 'ada@example.com' })
    expect(devCode).toBeTruthy()
    expect(await api.auth.checkPasswordReset(devCode)).toEqual({ email: 'ada@example.com' })

    const user = await api.auth.resetPassword({ code: devCode, password: 'a new long phrase' })
    expect(user).toMatchObject({ id: created.id, emailVerified: true })
    expect(await api.auth.me()).toMatchObject({ id: created.id })

    await api.auth.signOut()
    await expect(api.auth.signIn({ email: 'ada@example.com', password: PASSWORD })).rejects.toMatchObject({ code: 'unauthorized' })
  })

  test('a link works once, and a made-up one not at all', async () => {
    const api = newApi()
    await signUp(api)
    const { devCode } = await api.auth.requestPasswordReset({ email: 'ada@example.com' })
    await api.auth.resetPassword({ code: devCode, password: 'a new long phrase' })
    await expect(api.auth.resetPassword({ code: devCode, password: 'another long one' }))
      .rejects.toMatchObject({ code: 'unauthorized' })
    await expect(api.auth.checkPasswordReset('rst_madeup')).rejects.toMatchObject({ code: 'unauthorized' })
  })

  test('still insists on a good new password', async () => {
    const api = newApi()
    await signUp(api)
    const { devCode } = await api.auth.requestPasswordReset({ email: 'ada@example.com' })
    await expect(api.auth.resetPassword({ code: devCode, password: 'short' }))
      .rejects.toMatchObject({ code: 'validation', details: { field: 'password' } })
  })
})

describe('mock email confirmation', () => {
  test('confirms the address through the link, once', async () => {
    const api = newApi()
    await signUp(api)
    const { email, devCode } = await api.auth.sendEmailVerification()
    expect(email).toBe('ada@example.com')
    await api.auth.verifyEmail(devCode)
    expect((await api.auth.me()).emailVerified).toBe(true)
    await expect(api.auth.verifyEmail(devCode)).rejects.toMatchObject({ code: 'unauthorized' })
  })

  test('sends no link to an address that is already confirmed, and none to a guest', async () => {
    const api = newApi()
    await signUp(api)
    await confirmEmail(api)
    expect(await api.auth.sendEmailVerification()).toEqual({ email: 'ada@example.com' })
    await api.auth.signOut()
    await expect(api.auth.sendEmailVerification()).rejects.toMatchObject({ code: 'unauthorized' })
  })

  test('works signed out, since the link may be opened on another device', async () => {
    const api = newApi()
    await signUp(api)
    const { devCode } = await api.auth.sendEmailVerification()
    await api.auth.signOut()
    await api.auth.verifyEmail(devCode)
    const user = await api.auth.signIn({ email: 'ada@example.com', password: PASSWORD })
    expect(user.emailVerified).toBe(true)
  })
})

describe('mock account', () => {
  test('the adapter keeps the session, and signing out ends it', async () => {
    const api = newApi()
    expect(await api.auth.restore()).toBeNull()
    await expect(api.auth.me()).rejects.toMatchObject({ code: 'unauthorized' })
    await signUp(api)
    await api.auth.signOut()
    await expect(api.auth.me()).rejects.toMatchObject({ code: 'unauthorized' })
    expect(await api.auth.restore()).toBeNull()
  })

  test('saves profile changes and validates the phone number', async () => {
    const api = newApi()
    await signUp(api)
    const updated = await api.auth.updateProfile({ firstName: 'Ada', lastName: 'Nwosu', phone: '0803 123 4567' })
    expect(updated).toMatchObject({ firstName: 'Ada', lastName: 'Nwosu', name: 'Ada Nwosu', phone: '0803 123 4567' })
    expect(await api.auth.me()).toMatchObject({ name: 'Ada Nwosu', phone: '0803 123 4567' })

    expect((await api.auth.updateProfile({ firstName: 'Ada', lastName: 'Nwosu', phone: '' })).phone).toBeUndefined()
    await expect(api.auth.updateProfile({ firstName: 'Ada', lastName: 'Nwosu', phone: '12' }))
      .rejects.toMatchObject({ code: 'validation', details: { field: 'phone' } })
    await expect(api.auth.updateProfile({ firstName: 'Ada', lastName: '' }))
      .rejects.toMatchObject({ code: 'validation', details: { field: 'lastName' } })
  })

  test('returns copies, so the caller cannot edit the account in place', async () => {
    const api = newApi()
    const user = await signUp(api)
    user.name = 'Someone else'
    expect((await api.auth.me()).name).toBe('Ada Okoye')
  })
})
