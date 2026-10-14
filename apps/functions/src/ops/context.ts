import type { WriteBatch, Transaction } from 'firebase-admin/firestore'
import { COLLECTIONS } from '@afriff/api/firebase/schema'
import type { AuditDoc } from '@afriff/api/firebase/schema'
import type { StaffRole } from '@afriff/api/door'
import type { AuditTarget, OpsActionName } from '@afriff/api/ops'
import { db } from '../admin'

/** The staff member making a change, and when. */
export interface Who {
  uid: string
  name: string
  role: StaffRole
  now: Date
}

/** Strips the catalogue's list position, which the app never sees. */
export function withoutPosition<T extends object>(value: T & { position?: number }): T {
  const { position: _position, ...rest } = value
  return rest as T
}

/**
 * Records a change in the activity log, in the same write as the change itself
 * where there is one, so the log cannot miss what happened.
 */
export function audit(
  writer: Transaction | WriteBatch | null,
  who: Who,
  action: OpsActionName,
  summary: string,
  target?: AuditTarget,
  change?: { before?: Record<string, unknown>; after?: Record<string, unknown> },
) {
  const ref = db.collection(COLLECTIONS.audit).doc()
  const entry: AuditDoc = {
    at: who.now.toISOString(),
    byUid: who.uid,
    byName: who.name,
    action,
    summary,
    ...(target ? { target } : {}),
    ...(change?.before ? { before: change.before } : {}),
    ...(change?.after ? { after: change.after } : {}),
  }
  if (writer) writer.create(ref, entry)
  else return ref.create(entry)
}
