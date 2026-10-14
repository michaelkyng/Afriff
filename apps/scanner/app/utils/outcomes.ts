import { doorsOpenAt, isPass } from '@afriff/api/door'
import type { CheckInOutcome, CheckInResult, DoorSession } from '@afriff/api/door'
import { formatTime } from '@afriff/api/format'

/** How a result lands: let them in, take a second look, or stop. */
export type OutcomeTone = 'good' | 'warn' | 'bad'

export interface OutcomeCopy {
  tone: OutcomeTone
  title: string
  /** One sentence on why, or what to do. */
  detail?: string
  /** True when staff should read it before the next scan; good results clear themselves. */
  hold: boolean
}

const TONES: Record<CheckInOutcome, OutcomeTone> = {
  admitted: 'good',
  already_in: 'warn',
  too_early: 'warn',
  ended: 'warn',
  wrong_session: 'bad',
  passed_on: 'bad',
  void: 'bad',
  unknown: 'bad',
  full: 'bad',
}

/**
 * The words on the result screen, written to be read in a second by someone
 * holding a queue. Copy rules as elsewhere: no em or en dashes.
 */
export function describeOutcome(result: CheckInResult, session: DoorSession): OutcomeCopy {
  const tone = TONES[result.outcome]
  const hold = tone !== 'good'
  const ticket = result.ticket
  const where = session.ref.kind === 'screening' ? 'screening' : 'event'

  switch (result.outcome) {
    case 'admitted':
      return { tone, hold, title: 'Admitted', detail: ticket && isPass(ticket) ? `On a ${ticket.productName}.` : undefined }
    case 'already_in': {
      const when = result.previous ? ` at ${formatTime(result.previous.at)}` : ''
      const by = result.previous?.byName ? `, by ${result.previous.byName}` : ''
      return { tone, hold, title: 'Already checked in', detail: `This ticket came in${when}${by}.` }
    }
    case 'wrong_session': {
      if (ticket && isPass(ticket)) return { tone, hold, title: `Not for this ${where}`, detail: `A ${ticket.productName} does not cover it.` }
      const valid = ticket ? `It is for ${ticket.title}${ticket.subtitle ? `, ${ticket.subtitle}` : ''}.` : undefined
      return { tone, hold, title: `Not for this ${where}`, detail: valid }
    }
    case 'passed_on':
      return { tone, hold, title: 'Passed on', detail: 'The holder gave this ticket to someone else, whose copy has its own code.' }
    case 'void':
      return { tone, hold, title: 'Cancelled ticket', detail: 'Send them to the festival desk.' }
    case 'unknown':
      return { tone, hold, title: 'Not a festival ticket', detail: 'Check the code was read right, or send them to the festival desk.' }
    case 'too_early':
      return { tone, hold, title: 'Doors not open yet', detail: `They open at ${formatTime(doorsOpenAt(session))}.` }
    case 'ended':
      return { tone, hold, title: `This ${where} has ended`, detail: `It finished at ${formatTime(session.endsAt)}. Check you picked the right one.` }
    case 'full':
      return { tone, hold, title: 'No seats left for passes', detail: 'Every seat not sold as a single ticket is taken. Single tickets still go in.' }
  }
}
