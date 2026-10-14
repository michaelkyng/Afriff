import { describe, expect, test } from 'bun:test'
import { assertFirebaseConfig, createFirebaseClient } from '../src/index'

const REAL = {
  apiKey: 'AIzaSyD-example-not-a-real-key',
  authDomain: 'afriff-staging.firebaseapp.com',
  projectId: 'afriff-staging',
  appId: '1:123456789012:web:abcdef0123456789',
  functionsRegion: 'europe-west1',
}

const EMULATED = { apiKey: '', authDomain: '', projectId: 'demo-afriff', appId: '', functionsRegion: 'europe-west1', emulatorHost: '127.0.0.1' }

describe('firebase client configuration', () => {
  test('accepts a complete project config', () => {
    expect(() => assertFirebaseConfig(REAL)).not.toThrow()
  })

  test('names every missing setting by its environment variable', () => {
    const attempt = () => assertFirebaseConfig({ ...REAL, apiKey: ' ', appId: '' })
    expect(attempt).toThrow('NUXT_PUBLIC_FIREBASE_API_KEY')
    expect(attempt).toThrow('NUXT_PUBLIC_FIREBASE_APP_ID')
  })

  test('rejects malformed project ids and a missing region', () => {
    for (const projectId of ['', 'AFRIFF', 'af', 'afriff_staging', '-afriff']) {
      expect(() => assertFirebaseConfig({ ...REAL, projectId })).toThrow('project id')
    }
    expect(() => assertFirebaseConfig({ ...REAL, functionsRegion: '' })).toThrow('functions region')
  })

  test('the emulators need only a project id, and demo projects need the emulators', () => {
    expect(() => assertFirebaseConfig(EMULATED)).not.toThrow()
    expect(() => assertFirebaseConfig({ ...EMULATED, emulatorHost: '' })).toThrow('demo- projects only run in the emulators')
  })

  test('creates Auth, Firestore and Functions against the emulators without connecting', () => {
    const client = createFirebaseClient({ ...EMULATED, persistence: 'memory', name: 'client-test' })
    expect(client.emulated).toBe(true)
    expect(client.app.options.projectId).toBe('demo-afriff')
    expect(client.auth.currentUser).toBeNull()
    expect(client.functions.region).toBe('europe-west1')
    expect(typeof client.db.type).toBe('string')
  })
})
