/**
 * Firestore security rules, run against the emulator:
 *
 *   bun run test:rules
 *
 * Needs Java 21+ for the emulator. Runs under Node's test runner rather than
 * Bun's, because the Firestore SDK's Node transport is what the emulator expects.
 */
import { after, before, beforeEach, describe, test } from 'node:test'
import { readFileSync } from 'node:fs'
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing'
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  setLogLevel,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore'

let env

// Every assertFails is a denied write the SDK would otherwise log as an error.
setLogLevel('silent')

const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':')

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-afriff-rules',
    firestore: {
      rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'),
      host,
      port: Number(port),
    },
  })
})

after(async () => {
  await env?.cleanup()
})

beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore()
    await Promise.all([
      setDoc(doc(db, 'festival/current'), { id: 'afriff-2026', name: 'AFRIFF' }),
      setDoc(doc(db, 'films/flm_1'), { id: 'flm_1', slug: 'salt-roads', title: 'Salt Roads', position: 0 }),
      setDoc(doc(db, 'screenings/scr_1'), { id: 'scr_1', capacity: 10, sold: 0 }),
      setDoc(doc(db, 'events/evt_1'), { id: 'evt_1', title: 'Writing masterclass' }),
      setDoc(doc(db, 'products/prod_1'), { id: 'prod_1', remaining: 10 }),
      setDoc(doc(db, 'info/current'), { faqs: [] }),
      setDoc(doc(db, 'updates/upd_1'), { id: 'upd_1', title: 'Programme live' }),
      setDoc(doc(db, 'users/bem'), {
        email: 'bem@example.com',
        firstName: 'Bem',
        lastName: 'Tersoo',
        name: 'Bem Tersoo',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      }),
      setDoc(doc(db, 'users/ada/saved/film_flm_1'), { kind: 'film', refId: 'flm_1', savedAt: Timestamp.now() }),
      setDoc(doc(db, 'orders/ord_ada'), { id: 'ord_ada', userId: 'ada', status: 'paid' }),
      setDoc(doc(db, 'orders/ord_bem'), { id: 'ord_bem', userId: 'bem', status: 'paid' }),
      setDoc(doc(db, 'tickets/tkt_ada'), { id: 'tkt_ada', userId: 'ada', code: 'AF-AAAA-AAAA' }),
      setDoc(doc(db, 'tickets/tkt_bem'), { id: 'tkt_bem', userId: 'bem', code: 'AF-BBBB-BBBB' }),
      setDoc(doc(db, 'tickets/tkt_for_ada'), { id: 'tkt_for_ada', userId: null, claimEmail: 'ada@example.com' }),
      setDoc(doc(db, 'tickets/tkt_for_bem'), { id: 'tkt_for_bem', userId: null, claimEmail: 'bem@example.com' }),
      setDoc(doc(db, 'mail/m_1'), { template: 'order_paid', status: 'sent' }),
      setDoc(doc(db, 'paymentEvents/charge.success_AF-1'), { reference: 'AF-1' }),
      setDoc(doc(db, 'doorStats/screening_scr_1'), { admitted: 3, passAdmitted: 1, updatedAt: '2026-11-03T18:00:00Z' }),
      setDoc(doc(db, 'checkins/screening_scr_1_tkt_ada'), { ticketId: 'tkt_ada', byUid: 'door1' }),
      setDoc(doc(db, 'audit/a_1'), { action: 'moveScreening', byUid: 'ops1' }),
      setDoc(doc(db, 'staff/door1'), { email: 'door1@afriff.test', role: 'door', active: true }),
    ])
  })
})

/** Ada has confirmed her email; Bem has not. */
const ada = () => env.authenticatedContext('ada', { email: 'ada@example.com', email_verified: true }).firestore()
const bem = () => env.authenticatedContext('bem', { email: 'bem@example.com', email_verified: false }).firestore()
const guest = () => env.unauthenticatedContext().firestore()
/** Door staff: an account with a `role` claim. */
const door = () => env.authenticatedContext('door1', { email: 'door1@afriff.test', email_verified: true, role: 'door' }).firestore()
/** Ops staff, who run the console. */
const ops = () => env.authenticatedContext('ops1', { email: 'ops1@afriff.test', email_verified: true, role: 'ops' }).firestore()

const profile = (overrides = {}) => ({
  email: 'ada@example.com',
  firstName: 'Ada',
  lastName: 'Okoye',
  name: 'Ada Okoye',
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  ...overrides,
})

const saved = (kind, refId, overrides = {}) => ({ kind, refId, savedAt: serverTimestamp(), ...overrides })

describe('the public catalogue', () => {
  test('is readable by anyone, signed in or not', async () => {
    for (const db of [guest(), ada()]) {
      await assertSucceeds(getDoc(doc(db, 'festival/current')))
      await assertSucceeds(getDocs(collection(db, 'films')))
      await assertSucceeds(getDocs(query(collection(db, 'films'), where('slug', '==', 'salt-roads'))))
      await assertSucceeds(getDocs(collection(db, 'screenings')))
      await assertSucceeds(getDocs(collection(db, 'products')))
      await assertSucceeds(getDoc(doc(db, 'info/current')))
      await assertSucceeds(getDocs(collection(db, 'updates')))
    }
  })

  test('cannot be written from the app, least of all the stock', async () => {
    await assertFails(updateDoc(doc(ada(), 'products/prod_1'), { remaining: 1000 }))
    await assertFails(updateDoc(doc(ada(), 'screenings/scr_1'), { sold: 0 }))
    await assertFails(setDoc(doc(ada(), 'films/flm_2'), { id: 'flm_2', title: 'Mine' }))
    await assertFails(deleteDoc(doc(ada(), 'updates/upd_1')))
    await assertFails(setDoc(doc(guest(), 'festival/current'), { id: 'x' }))
  })
})

describe('profiles', () => {
  test('an attendee creates their own, with the server clock', async () => {
    await assertSucceeds(setDoc(doc(ada(), 'users/ada'), profile()))
  })

  test('a phone number is optional, and has to be Nigerian', async () => {
    await assertSucceeds(setDoc(doc(ada(), 'users/ada'), profile({ phone: '0803 123 4567' })))
    await env.clearFirestore()
    await assertFails(setDoc(doc(ada(), 'users/ada'), profile({ phone: '+44 7700 900123' })))
  })

  test('cannot be made for someone else, or by a guest', async () => {
    await assertFails(setDoc(doc(ada(), 'users/zainab'), profile()))
    await assertFails(setDoc(doc(guest(), 'users/ada'), profile()))
  })

  test('has to carry the email on the sign-in', async () => {
    await assertFails(setDoc(doc(ada(), 'users/ada'), profile({ email: 'someone@else.com' })))
  })

  test('refuses names that do not add up, untrimmed names and empty ones', async () => {
    await assertFails(setDoc(doc(ada(), 'users/ada'), profile({ name: 'Somebody Else' })))
    await assertFails(setDoc(doc(ada(), 'users/ada'), profile({ firstName: ' Ada', name: ' Ada Okoye' })))
    await assertFails(setDoc(doc(ada(), 'users/ada'), profile({ lastName: '', name: 'Ada ' })))
    await assertFails(setDoc(doc(ada(), 'users/ada'), profile({ firstName: 'A'.repeat(31), name: `${'A'.repeat(31)} Okoye` })))
  })

  test('refuses a backdated creation time and fields of its own invention', async () => {
    await assertFails(setDoc(doc(ada(), 'users/ada'), profile({ createdAt: Timestamp.fromDate(new Date('2020-01-01')) })))
    await assertFails(setDoc(doc(ada(), 'users/ada'), profile({ role: 'admin' })))
  })

  test('the owner changes names and phone, and clears the phone', async () => {
    await assertSucceeds(updateDoc(doc(bem(), 'users/bem'), {
      firstName: 'Bemdoo',
      name: 'Bemdoo Tersoo',
      phone: '+234 803 123 4567',
      updatedAt: serverTimestamp(),
    }))
    await assertSucceeds(updateDoc(doc(bem(), 'users/bem'), { phone: deleteField(), updatedAt: serverTimestamp() }))
  })

  test('the email and creation time never change, and the full name follows the parts', async () => {
    await assertFails(updateDoc(doc(bem(), 'users/bem'), { email: 'new@example.com', updatedAt: serverTimestamp() }))
    await assertFails(updateDoc(doc(bem(), 'users/bem'), { createdAt: serverTimestamp(), updatedAt: serverTimestamp() }))
    await assertFails(updateDoc(doc(bem(), 'users/bem'), { firstName: 'Bemdoo', updatedAt: serverTimestamp() }))
    await assertFails(updateDoc(doc(bem(), 'users/bem'), { firstName: 'Bemdoo', name: 'Bemdoo Tersoo' }))
  })

  test('is private to its owner, cannot be listed and cannot be deleted', async () => {
    await assertSucceeds(getDoc(doc(bem(), 'users/bem')))
    await assertFails(getDoc(doc(ada(), 'users/bem')))
    await assertFails(getDocs(collection(ada(), 'users')))
    await assertFails(deleteDoc(doc(bem(), 'users/bem')))
  })
})

describe('the saved list', () => {
  test('takes films, screenings and events that are in the programme', async () => {
    await assertSucceeds(setDoc(doc(ada(), 'users/ada/saved/screening_scr_1'), saved('screening', 'scr_1')))
    await assertSucceeds(setDoc(doc(ada(), 'users/ada/saved/event_evt_1'), saved('event', 'evt_1')))
    await assertSucceeds(setDoc(doc(bem(), 'users/bem/saved/film_flm_1'), saved('film', 'flm_1')))
  })

  test('refuses what is not in the programme, a mismatched id, an unknown kind and a device clock', async () => {
    await assertFails(setDoc(doc(ada(), 'users/ada/saved/film_flm_404'), saved('film', 'flm_404')))
    await assertFails(setDoc(doc(ada(), 'users/ada/saved/film_scr_1'), saved('screening', 'scr_1')))
    await assertFails(setDoc(doc(ada(), 'users/ada/saved/venue_flm_1'), saved('venue', 'flm_1')))
    await assertFails(setDoc(doc(ada(), 'users/ada/saved/screening_scr_1'), saved('screening', 'scr_1', { savedAt: Timestamp.now() })))
    await assertFails(setDoc(doc(ada(), 'users/ada/saved/screening_scr_1'), saved('screening', 'scr_1', { note: 'x' })))
  })

  test('belongs to its owner alone', async () => {
    await assertSucceeds(getDocs(collection(ada(), 'users/ada/saved')))
    await assertFails(getDocs(collection(bem(), 'users/ada/saved')))
    await assertFails(setDoc(doc(bem(), 'users/ada/saved/screening_scr_1'), saved('screening', 'scr_1')))
    await assertFails(deleteDoc(doc(bem(), 'users/ada/saved/film_flm_1')))
    await assertSucceeds(deleteDoc(doc(ada(), 'users/ada/saved/film_flm_1')))
  })

  test('cannot be rewritten in place, which would move it up the list', async () => {
    await assertFails(setDoc(doc(ada(), 'users/ada/saved/film_flm_1'), saved('film', 'flm_1')))
  })
})

describe('orders', () => {
  test('an attendee reads their own, by id or by asking for their userId', async () => {
    await assertSucceeds(getDoc(doc(ada(), 'orders/ord_ada')))
    await assertSucceeds(getDocs(query(collection(ada(), 'orders'), where('userId', '==', 'ada'))))
  })

  test('nobody reads anyone else’s, or lists them all', async () => {
    await assertFails(getDoc(doc(ada(), 'orders/ord_bem')))
    await assertFails(getDocs(query(collection(ada(), 'orders'), where('userId', '==', 'bem'))))
    await assertFails(getDocs(collection(ada(), 'orders')))
    await assertFails(getDoc(doc(guest(), 'orders/ord_ada')))
  })

  test('cannot be placed, paid or changed from the app', async () => {
    await assertFails(updateDoc(doc(ada(), 'orders/ord_ada'), { status: 'paid' }))
    await assertFails(setDoc(doc(ada(), 'orders/ord_new'), { id: 'ord_new', userId: 'ada', status: 'paid' }))
    await assertFails(deleteDoc(doc(ada(), 'orders/ord_ada')))
  })
})

describe('tickets', () => {
  test('an attendee reads their own, and only their own', async () => {
    await assertSucceeds(getDoc(doc(ada(), 'tickets/tkt_ada')))
    await assertSucceeds(getDocs(query(collection(ada(), 'tickets'), where('userId', '==', 'ada'))))
    await assertFails(getDoc(doc(ada(), 'tickets/tkt_bem')))
    await assertFails(getDocs(collection(ada(), 'tickets')))
  })

  test('a confirmed address sees tickets waiting for it', async () => {
    await assertSucceeds(getDoc(doc(ada(), 'tickets/tkt_for_ada')))
    await assertSucceeds(getDocs(query(
      collection(ada(), 'tickets'),
      where('claimEmail', '==', 'ada@example.com'),
      where('userId', '==', null),
    )))
  })

  test('an unconfirmed address does not, and nobody sees what waits for someone else', async () => {
    await assertFails(getDoc(doc(bem(), 'tickets/tkt_for_bem')))
    await assertFails(getDocs(query(
      collection(bem(), 'tickets'),
      where('claimEmail', '==', 'bem@example.com'),
      where('userId', '==', null),
    )))
    await assertFails(getDoc(doc(ada(), 'tickets/tkt_for_bem')))
  })

  test('cannot be issued, claimed or changed from the app', async () => {
    await assertFails(updateDoc(doc(ada(), 'tickets/tkt_for_ada'), { userId: 'ada' }))
    await assertFails(updateDoc(doc(ada(), 'tickets/tkt_ada'), { status: 'valid' }))
    await assertFails(setDoc(doc(ada(), 'tickets/tkt_new'), { id: 'tkt_new', userId: 'ada' }))
  })
})

describe('server-only collections', () => {
  test('the mail outbox and payment events are closed to the app', async () => {
    for (const path of ['mail/m_1', 'paymentEvents/charge.success_AF-1']) {
      await assertFails(getDoc(doc(ada(), path)))
      await assertFails(setDoc(doc(ada(), path), { tampered: true }))
    }
    await assertFails(getDocs(collection(ada(), 'mail')))
    await assertFails(setDoc(doc(ada(), 'mail/m_2'), { template: 'order_paid', to: { email: 'victim@example.com' } }))
  })
})

describe('the door', () => {
  test('staff follow a session’s running count; attendees and guests cannot', async () => {
    await assertSucceeds(getDoc(doc(door(), 'doorStats/screening_scr_1')))
    await assertFails(getDoc(doc(ada(), 'doorStats/screening_scr_1')))
    await assertFails(getDoc(doc(guest(), 'doorStats/screening_scr_1')))
  })

  test('a made-up role is not staff', async () => {
    const pretender = env.authenticatedContext('eve', { email: 'eve@example.com', role: 'superuser' }).firestore()
    await assertFails(getDoc(doc(pretender, 'doorStats/screening_scr_1')))
  })

  test('nobody writes counts or check-ins from an app, staff included', async () => {
    await assertFails(setDoc(doc(door(), 'doorStats/screening_scr_1'), { admitted: 0, passAdmitted: 0 }))
    await assertFails(setDoc(doc(door(), 'checkins/screening_scr_1_tkt_bem'), { ticketId: 'tkt_bem' }))
    await assertFails(getDoc(doc(door(), 'checkins/screening_scr_1_tkt_ada')))
    await assertFails(updateDoc(doc(door(), 'tickets/tkt_ada'), { status: 'used' }))
  })

  test('staff do not read attendees’ tickets or orders directly', async () => {
    await assertFails(getDoc(doc(door(), 'tickets/tkt_ada')))
    await assertFails(getDoc(doc(door(), 'orders/ord_ada')))
  })
})

describe('the Ops Console', () => {
  test('ops staff read what support needs: any order, ticket, profile, email, check-in and the log', async () => {
    await assertSucceeds(getDoc(doc(ops(), 'orders/ord_ada')))
    await assertSucceeds(getDocs(query(collection(ops(), 'orders'), where('status', '==', 'paid'))))
    await assertSucceeds(getDocs(collection(ops(), 'orders')))
    await assertSucceeds(getDoc(doc(ops(), 'tickets/tkt_bem')))
    await assertSucceeds(getDocs(query(collection(ops(), 'tickets'), where('code', '==', 'AF-AAAA-AAAA'))))
    await assertSucceeds(getDoc(doc(ops(), 'users/bem')))
    await assertSucceeds(getDoc(doc(ops(), 'mail/m_1')))
    await assertSucceeds(getDoc(doc(ops(), 'paymentEvents/charge.success_AF-1')))
    await assertSucceeds(getDoc(doc(ops(), 'checkins/screening_scr_1_tkt_ada')))
    await assertSucceeds(getDocs(collection(ops(), 'audit')))
    await assertSucceeds(getDocs(collection(ops(), 'staff')))
  })

  test('but change nothing directly: every change goes through the ops function', async () => {
    await assertFails(updateDoc(doc(ops(), 'orders/ord_ada'), { refundDue: false }))
    await assertFails(updateDoc(doc(ops(), 'tickets/tkt_ada'), { status: 'void' }))
    await assertFails(updateDoc(doc(ops(), 'screenings/scr_1'), { cancelled: true }))
    await assertFails(setDoc(doc(ops(), 'updates/upd_2'), { id: 'upd_2', title: 'Hello' }))
    await assertFails(setDoc(doc(ops(), 'audit/a_2'), { action: 'moveScreening' }))
    await assertFails(deleteDoc(doc(ops(), 'audit/a_1')))
    await assertFails(setDoc(doc(ops(), 'staff/ops1'), { role: 'admin' }))
  })

  test('door staff and attendees see none of it', async () => {
    for (const db of [door(), ada()]) {
      await assertFails(getDocs(collection(db, 'audit')))
      await assertFails(getDocs(collection(db, 'staff')))
      await assertFails(getDoc(doc(db, 'mail/m_1')))
      await assertFails(getDocs(collection(db, 'orders')))
    }
    await assertFails(getDoc(doc(door(), 'users/bem')))
  })
})
