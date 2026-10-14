import { randomBytes } from 'node:crypto'
import { ApiError } from '@afriff/api'
import type { StaffRole } from '@afriff/api/door'
import { COLLECTIONS } from '@afriff/api/firebase/schema'
import type { MailDoc, StaffDoc } from '@afriff/api/firebase/schema'
import type { InviteStaffInput, SetStaffRoleInput, StaffAccount } from '@afriff/api/ops'
import { adminAuth, collections, db } from '../admin'
import { DOOR_URL, OPS_URL } from '../env'
import { staffInviteMail } from '../mail/templates'
import { audit } from './context'
import type { Who } from './context'

const staffDocs = () => db.collection(COLLECTIONS.staff)

const toAccount = (uid: string, doc: StaffDoc): StaffAccount => ({
  id: uid,
  email: doc.email,
  name: doc.name,
  role: doc.role ?? 'door',
  active: doc.active,
  updatedAt: doc.updatedAt,
})

export async function listStaff(): Promise<StaffAccount[]> {
  const snapshot = await staffDocs().get()
  return snapshot.docs
    .map((doc) => toAccount(doc.id, doc.data() as StaffDoc))
    .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name))
}

/** Sets the claim, ends current sessions so it applies at once, and keeps `staff/{uid}` in step. */
async function applyRole(uid: string, email: string, name: string, role: StaffRole | null, who: Who): Promise<StaffDoc> {
  const user = await adminAuth.getUser(uid)
  const claims = { ...(user.customClaims ?? {}) }
  if (role) claims.role = role
  else delete claims.role
  await adminAuth.setCustomUserClaims(uid, claims)
  await adminAuth.revokeRefreshTokens(uid)
  const doc: StaffDoc = { email, name, role, active: Boolean(role), updatedAt: who.now.toISOString(), updatedBy: who.uid }
  await staffDocs().doc(uid).set(doc)
  return doc
}

/**
 * Gives someone a staff role, making their account if they have none, and
 * emails them a link to set their own password. Nobody is ever given a
 * password someone else chose.
 */
export async function inviteStaff(input: InviteStaffInput, who: Who): Promise<{ staff: StaffAccount; inviteSent: boolean }> {
  let uid: string
  let created = false
  try {
    uid = (await adminAuth.getUserByEmail(input.email)).uid
  }
  catch (error) {
    if ((error as { code?: string }).code !== 'auth/user-not-found') throw error
    uid = (await adminAuth.createUser({
      email: input.email,
      emailVerified: true,
      displayName: input.name,
      password: randomBytes(24).toString('base64url'),
    })).uid
    created = true
  }
  const doc = await applyRole(uid, input.email, input.name, input.role, who)

  const signInUrl = (input.role === 'door' ? DOOR_URL : OPS_URL).value().trim()
  const link = await adminAuth.generatePasswordResetLink(input.email, signInUrl ? { url: signInUrl } : undefined)
  const mail: MailDoc = {
    ...staffInviteMail({ email: input.email, name: input.name }, { name: input.name, role: input.role, setPasswordUrl: link, signInUrl, invitedBy: who.name, newAccount: created }),
    status: 'queued',
    attempts: 0,
    createdAt: who.now.toISOString(),
  }
  await collections.mail().doc().create(mail)
  await audit(null, who, 'inviteStaff', `Invited ${input.name} (${input.email}) as ${input.role}`, { kind: 'staff', id: uid })
  return { staff: toAccount(uid, doc), inviteSent: true }
}

export async function setStaffRole(input: SetStaffRoleInput, who: Who): Promise<StaffAccount> {
  if (input.uid === who.uid) throw new ApiError('conflict', 'You cannot change your own role. Ask another admin.')
  const existing = (await staffDocs().doc(input.uid).get()).data() as StaffDoc | undefined
  if (!existing) throw new ApiError('not_found', 'That person is not on the staff list.', { uid: input.uid })
  const doc = await applyRole(input.uid, existing.email, existing.name, input.role, who)
  await audit(null, who, 'setStaffRole', input.role ? `Made ${existing.name} ${input.role}` : `Took staff access from ${existing.name}`, { kind: 'staff', id: input.uid },
    { before: { role: existing.role }, after: { role: input.role } })
  return toAccount(input.uid, doc)
}
