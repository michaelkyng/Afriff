/**
 * Gives a festival staff member a role, creating their account if needed, until
 * the Ops Console can. The role is a Firebase custom claim, which the `checkIn`
 * function and the Firestore rules check.
 *
 *   bun run staff -- --email door1@afriff.com --role door --name "Door 1"            emulator
 *   bun run staff -- --email door1@afriff.com --role door --project <id> --yes        a real project
 *   bun run staff -- --email door1@afriff.com --remove --project <id> --yes           take the role away
 *
 * Roles: door (scan tickets), ops (run the Ops Console) and admin (Ops, plus
 * managing staff). Ops and admin can also scan. Once there is an admin, the
 * Ops Console's Staff page does all of this.
 *
 * In the emulator a new account gets `--password`, or "door-demo-1". On a real
 * project it gets a random password and the script prints a link to set their
 * own, so no password is ever chosen for someone.
 */
import { randomBytes } from 'node:crypto'
import { initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { isStaffRole, STAFF_ROLES } from '@afriff/api/door'
import type { StaffRole } from '@afriff/api/door'
import { COLLECTIONS } from '@afriff/api/firebase/schema'
import type { StaffDoc } from '@afriff/api/firebase/schema'

const args = process.argv.slice(2)
const option = (name: string) => {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : undefined
}
const fail = (message: string): never => {
  console.error(message)
  process.exit(1)
}

const projectId = option('--project') ?? 'demo-afriff'
const emulated = projectId.startsWith('demo-')
const email = option('--email')?.trim().toLowerCase()
const role = option('--role')
const remove = args.includes('--remove')

if (!email) fail('Give the staff member’s --email.')
if (!remove && !isStaffRole(role)) fail(`Give a --role: ${STAFF_ROLES.join(', ')}.`)
if (emulated) {
  process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099'
  process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080'
}
else {
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIRESTORE_EMULATOR_HOST) {
    fail('An emulator host is set, so this would change the emulator. Unset FIREBASE_AUTH_EMULATOR_HOST and FIRESTORE_EMULATOR_HOST first.')
  }
  if (!args.includes('--yes')) fail(`This changes staff access on the real project "${projectId}". Run again with --yes.`)
}

const app = initializeApp({ projectId })
const auth = getAuth(app)
const db = getFirestore(app)

async function findOrCreate() {
  try {
    return { user: await auth.getUserByEmail(email!), created: false }
  }
  catch (error) {
    if ((error as { code?: string }).code !== 'auth/user-not-found') throw error
  }
  if (remove) fail(`No account for ${email}.`)
  const user = await auth.createUser({
    email: email!,
    emailVerified: true,
    displayName: option('--name') ?? email!.split('@')[0],
    password: emulated ? (option('--password') ?? 'door-demo-1') : randomBytes(24).toString('base64url'),
  })
  return { user, created: true }
}

const { user, created } = await findOrCreate()
const claims = { ...(user.customClaims ?? {}) }
if (remove) delete claims.role
else claims.role = role
await auth.setCustomUserClaims(user.uid, claims)
// Ends their current sessions, so the change applies at once rather than when their token next refreshes.
await auth.revokeRefreshTokens(user.uid)
if (option('--name') && !created) await auth.updateUser(user.uid, { displayName: option('--name') })
// The staff list the Ops Console reads, kept in step with the claim.
const record: StaffDoc = {
  email: email!,
  name: option('--name') ?? user.displayName ?? email!.split('@')[0]!,
  role: remove ? null : (role as StaffRole),
  active: !remove,
  updatedAt: new Date().toISOString(),
  updatedBy: 'bun run staff',
}
await db.collection(COLLECTIONS.staff).doc(user.uid).set(record)

const where = emulated ? `the emulator (${projectId})` : projectId
if (remove) {
  console.log(`${email} is no longer staff on ${where}.`)
}
else {
  console.log(`${email} is now ${role} on ${where}${created ? ' (new account)' : ''}.`)
  if (created && emulated) console.log(`Password: ${option('--password') ?? 'door-demo-1'}`)
  if (created && !emulated) {
    console.log('Send them this link to choose their password:')
    console.log(await auth.generatePasswordResetLink(email!))
  }
}
