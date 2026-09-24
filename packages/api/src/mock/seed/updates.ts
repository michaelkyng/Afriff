import type { FestivalUpdate } from '../../types'

/**
 * MOCK DATA — fictional announcements and changes.
 *
 * They are spread across the week and carry the moment they were published, so
 * the inbox fills as the festival clock moves: before the festival there are
 * only the announcements, and the changes arrive on the days they affect. The
 * dev clock on the Me tab is what makes them appear.
 */
export const updates: FestivalUpdate[] = [
  {
    id: 'upd_programme_live',
    kind: 'announcement',
    severity: 'normal',
    title: 'The full programme is live',
    body: 'Every screening, masterclass and gala for the 2026 edition is now listed. Passes are on sale.',
    publishedAt: '2026-09-15T10:00:00+01:00',
    link: '/programme',
  },
  {
    id: 'upd_market_accreditation',
    kind: 'announcement',
    severity: 'normal',
    title: 'Film market accreditation closes Friday',
    body: 'Industry delegates have until Friday to complete accreditation for the market at Landmark.',
    publishedAt: '2026-10-23T09:30:00+01:00',
  },
  {
    id: 'upd_opening_carpet',
    kind: 'announcement',
    severity: 'normal',
    title: 'Opening night: doors at 18:00',
    body: 'The red carpet opens at 18:00 and the gala screening starts at 19:30. Come early; Victoria Island traffic on a Sunday evening is its own event.',
    publishedAt: '2026-10-30T12:00:00+01:00',
    subject: { eventId: 'evt_opening' },
    link: '/tickets',
  },
  {
    id: 'upd_harmattan_moved',
    kind: 'schedule',
    severity: 'urgent',
    title: 'The Harmattan Letters moves to Cinema 2',
    body: 'Sunday’s 16:00 screening moves from Cinema 1 to Cinema 2 at Landmark. Same time, same ticket, one door further along.',
    publishedAt: '2026-11-01T09:15:00+01:00',
    subject: { screeningId: 'scn_the-harmattan-letters_1' },
  },
  {
    id: 'upd_terra_parking',
    kind: 'venue',
    severity: 'normal',
    title: 'Terra Kulture parking is full from 17:00',
    body: 'The car park fills before the evening screenings. There is overflow parking two streets down on Tiamiyu Savage.',
    publishedAt: '2026-11-01T14:00:00+01:00',
    subject: { venueId: 'ven_terrakulture' },
    link: '/venues/terra-kulture',
  },
  {
    id: 'upd_qa_added',
    kind: 'schedule',
    severity: 'normal',
    title: 'Q&A added to Blue Hour in Kigali',
    body: 'The director joins Sunday’s 18:30 screening at Terra Kulture for twenty minutes of questions afterwards.',
    publishedAt: '2026-11-01T16:20:00+01:00',
    subject: { screeningId: 'scn_blue-hour-in-kigali_2' },
  },
  {
    id: 'upd_masterclass_room',
    kind: 'venue',
    severity: 'normal',
    title: 'Writing for the Screen moves upstairs',
    body: 'Monday’s masterclass is in the upstairs gallery at Terra Kulture. Signs are up from the entrance.',
    publishedAt: '2026-11-02T08:00:00+01:00',
    subject: { eventId: 'evt_mc_writing' },
  },
  {
    id: 'upd_shuttle',
    kind: 'announcement',
    severity: 'normal',
    title: 'Shuttle between Landmark and Eko Hotel',
    body: 'A free shuttle runs every twenty minutes from 15:00 until midnight, for anyone crossing between the two venues.',
    publishedAt: '2026-11-02T11:00:00+01:00',
  },
  {
    id: 'upd_power_terra',
    kind: 'venue',
    severity: 'urgent',
    title: 'Terra Kulture screenings pushed back 30 minutes',
    body: 'A power fault at Terra Kulture has put Tuesday’s screenings back half an hour. Tickets stay valid and nothing is cancelled.',
    publishedAt: '2026-11-03T10:45:00+01:00',
    subject: { venueId: 'ven_terrakulture' },
  },
  {
    id: 'upd_globe_dress',
    kind: 'announcement',
    severity: 'normal',
    title: 'Globe Awards Night: black tie',
    body: 'Saturday’s awards night at Eko Hotel is black tie. Doors at 18:30, seated by 19:15.',
    publishedAt: '2026-11-05T10:00:00+01:00',
    subject: { eventId: 'evt_globe' },
  },
  {
    id: 'upd_closing_thanks',
    kind: 'announcement',
    severity: 'normal',
    title: 'That’s a wrap',
    body: 'Thank you for a full week of cinema. Award winners and the encore screenings are listed on the programme.',
    publishedAt: '2026-11-08T12:00:00+01:00',
    link: '/programme',
  },
]
