import { ApiError } from '@afriff/api'
import { canDo, canUseOps } from '@afriff/api/ops'
import type { OpsActionName } from '@afriff/api/ops'
import { opsActionSchema } from '@afriff/validation'
import { callable, parse } from '../callable'
import type { Who } from './context'
import { updateProduct, markRefunded, reissueTicket, resendOrderEmail, voidTicket } from './orders'
import { cancelScreening, moveScreening } from './screenings'
import { inviteStaff, listStaff, setStaffRole } from './staff'
import { deleteUpdate, publishUpdate } from './updates'

/**
 * Every change the Ops Console makes, as one callable: one warm instance for
 * the whole console, one place that checks who may do what, and every change
 * recorded in the activity log by the handler that makes it.
 */
export const ops = callable<'ops'>({ timeoutSeconds: 120 }, async (data, caller) => {
  if (!canUseOps(caller.role)) throw new ApiError('unauthorized', 'This account is not set up for Ops. Ask an admin.')
  const request = parse(opsActionSchema, data, 'Check the details and try again.')
  const action: OpsActionName = request.action
  if (!canDo(caller.role, action)) throw new ApiError('unauthorized', 'Only an admin can do that.')
  const who: Who = { uid: caller.uid, name: caller.name ?? caller.email ?? 'Ops', role: caller.role!, now: new Date() }

  switch (request.action) {
    case 'moveScreening': return moveScreening(request, who)
    case 'cancelScreening': return cancelScreening(request, who)
    case 'publishUpdate': return publishUpdate(request, who)
    case 'deleteUpdate': return deleteUpdate(request, who)
    case 'updateProduct': return updateProduct(request, who)
    case 'resendOrderEmail': return resendOrderEmail(request, who)
    case 'voidTicket': return voidTicket(request, who)
    case 'reissueTicket': return reissueTicket(request, who)
    case 'markRefunded': return markRefunded(request, who)
    case 'listStaff': return listStaff()
    case 'inviteStaff': return inviteStaff(request, who)
    case 'setStaffRole': return setStaffRole(request, who)
  }
})
