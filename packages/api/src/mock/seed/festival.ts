import type { Festival } from '../../types'

/**
 * MOCK DATA — placeholder edition details.
 * Dates are placeholders (1–7 Nov 2026) until the official dates are confirmed.
 */
export const festival: Festival = {
  id: 'afriff-2026',
  name: 'Africa International Film Festival',
  shortName: 'AFRIFF',
  editionTitle: 'AFRIFF 2026',
  tagline: 'Seven days of African stories on the big screen.',
  city: 'Lagos',
  timezone: 'Africa/Lagos',
  startsAt: '2026-11-01T10:00:00+01:00',
  endsAt: '2026-11-07T23:59:00+01:00',
  supportEmail: 'support@example.com',
  days: [
    { date: '2026-11-01', number: 1, label: 'Sun 1 Nov', highlight: 'Opening Night' },
    { date: '2026-11-02', number: 2, label: 'Mon 2 Nov', highlight: 'Film market opens' },
    { date: '2026-11-03', number: 3, label: 'Tue 3 Nov' },
    { date: '2026-11-04', number: 4, label: 'Wed 4 Nov' },
    { date: '2026-11-05', number: 5, label: 'Thu 5 Nov', highlight: 'Film market closes' },
    { date: '2026-11-06', number: 6, label: 'Fri 6 Nov' },
    { date: '2026-11-07', number: 7, label: 'Sat 7 Nov', highlight: 'Globe Awards' },
  ],
}
