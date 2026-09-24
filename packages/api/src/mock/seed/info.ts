import type { ContactInfo, Faq, Policy } from '../../types'
import { festival } from './festival'

/**
 * MOCK DATA — the answers a festival would publish, written as placeholders.
 *
 * Every line here is a promise to an attendee, so the real ones have to come
 * from AFRIFF before this ships. Confirm refunds, admission and accreditation
 * with the festival team.
 */

export const faqs: Faq[] = [
  // ---------------------------------------------------------------- tickets
  {
    id: 'faq_buy',
    topic: 'tickets',
    question: 'How do I buy a ticket?',
    answer:
      'Pick what you want on the Tickets tab: a festival pass, a day pass, a single screening, a masterclass or a gala. Add it to your cart and pay by card or bank transfer. Your ticket appears under My tickets as soon as the payment lands.',
    link: '/tickets',
    linkLabel: 'Go to tickets',
  },
  {
    id: 'faq_pass_vs_single',
    topic: 'tickets',
    question: 'What is the difference between a pass and a single ticket?',
    answer:
      'A festival pass covers every standard screening for the whole week, and a day pass covers one day. A single ticket is one seat at one screening. Galas and masterclasses are ticketed on their own, whichever pass you hold.',
  },
  {
    id: 'faq_ticket_offline',
    topic: 'tickets',
    question: 'Do I need data at the door?',
    answer:
      'No. Open your ticket once while you have a connection and it stays on your phone. The code works in airplane mode; turn your brightness up so it scans first time.',
    link: '/tickets?view=mine',
    linkLabel: 'My tickets',
  },
  {
    id: 'faq_transfer',
    topic: 'tickets',
    question: 'Can I give my ticket to someone else?',
    answer:
      'Yes. Open the ticket and choose "Pass it on", then enter their email. They get a ticket with its own code and yours stops working. It cannot be undone, so check the address.',
  },
  {
    id: 'faq_sold_out',
    topic: 'tickets',
    question: 'A screening is sold out. Is there a returns queue?',
    answer:
      'Returned seats go back on sale automatically, so it is worth checking the film page during the day. There is also a standby queue at the door: unclaimed seats are released five minutes before the start.',
  },
  {
    id: 'faq_receipt',
    topic: 'tickets',
    question: 'Where is my receipt?',
    answer: 'Every order has its own page with what you paid and how. You will find them all on the Me tab under Orders.',
    link: '/me',
    linkLabel: 'Open Me',
  },

  // ------------------------------------------------------- at the festival
  {
    id: 'faq_arrive',
    topic: 'at-the-festival',
    question: 'How early should I arrive?',
    answer:
      'Twenty minutes before a standard screening, and an hour before a gala. Doors close when the film starts; see the latecomers policy below.',
  },
  {
    id: 'faq_qa',
    topic: 'at-the-festival',
    question: 'Which screenings have a Q&A?',
    answer:
      'Screenings with a Q&A are marked in the programme. They run about twenty minutes after the credits, with the director or cast where they can be there.',
    link: '/programme',
    linkLabel: 'Browse the programme',
  },
  {
    id: 'faq_food',
    topic: 'at-the-festival',
    question: 'Is there food and drink?',
    answer:
      'Landmark and Twin Waters both have restaurants on site. Terra Kulture has a café. Eko Hotel serves food through gala nights. Outside food and drink are not allowed into the screens.',
  },
  {
    id: 'faq_children',
    topic: 'at-the-festival',
    question: 'Can I bring children?',
    answer:
      'Yes, to films rated G, PG and 12, where anyone under 12 comes with an adult. The 15 and 18 ratings are enforced at the door and photo ID may be asked for.',
  },
  {
    id: 'faq_lost',
    topic: 'at-the-festival',
    question: 'I have lost something. Now what?',
    answer: 'Ask at the festival desk in the venue you were last at. Anything handed in stays at that venue until the end of the festival.',
  },
  {
    id: 'faq_market',
    topic: 'at-the-festival',
    question: 'Can I attend the film market?',
    answer:
      'The AFRIFF Film & Content Market is for accredited industry delegates. Accreditation is separate from an attendee pass and closes before the festival opens.',
  },

  // ----------------------------------------------------------------- access
  {
    id: 'faq_step_free',
    topic: 'access',
    question: 'Are the venues step-free?',
    answer:
      'All four have step-free access to the screens in use, and accessible toilets. Each venue page lists what it has and anything worth knowing in advance.',
    link: '/info#venues',
    linkLabel: 'Venue details',
  },
  {
    id: 'faq_wheelchair',
    topic: 'access',
    question: 'How do I book a wheelchair space?',
    answer:
      'Buy any ticket for the screening, then email us with your order reference and we will hold a wheelchair space and a seat for whoever comes with you. Spaces are held until twenty minutes before the start.',
  },
  {
    id: 'faq_companion',
    topic: 'access',
    question: 'Is there a companion ticket?',
    answer:
      'Yes. Anyone who needs support to attend can bring one companion free of charge. Email us before the screening with your order reference and we will add them.',
  },
  {
    id: 'faq_subtitles',
    topic: 'access',
    question: 'Are films subtitled?',
    answer:
      'Films not in English are subtitled in English. Films in English are not captioned this year, which we know is a gap; the programme marks the language of every film.',
  },
  {
    id: 'faq_quiet',
    topic: 'access',
    question: 'Is there a quiet space?',
    answer: 'Landmark and Eko Hotel each keep a quiet room away from the screens. Ask at the festival desk and someone will take you there.',
  },

  // ---------------------------------------------------------- getting there
  {
    id: 'faq_venues',
    topic: 'getting-there',
    question: 'Where is everything?',
    answer:
      'Four venues, all on Victoria Island and Lekki: Landmark Centre, Twin Waters, Terra Kulture and Eko Hotel. Each venue page has directions, parking and what to expect at the door.',
    link: '/info#venues',
    linkLabel: 'See the venues',
  },
  {
    id: 'faq_shuttle',
    topic: 'getting-there',
    question: 'Is there a shuttle between venues?',
    answer:
      'A free shuttle runs between Landmark and Eko Hotel every twenty minutes from 15:00 until midnight during the festival. Show any festival ticket to board.',
  },
  {
    id: 'faq_parking',
    topic: 'getting-there',
    question: 'Can I park?',
    answer:
      'Landmark has a paid car park, Twin Waters is free, and Terra Kulture is small and fills early. Eko Hotel parking is free with a festival ticket. Each venue page says what to expect.',
  },
  {
    id: 'faq_traffic',
    topic: 'getting-there',
    question: 'How bad is the traffic?',
    answer:
      'Bad enough to plan around. Victoria Island slows from about 16:00 and Lekki from 17:00. Leave half an hour earlier than the map suggests for an evening screening.',
  },
]

export const policies: Policy[] = [
  {
    id: 'pol_admission',
    title: 'Admission and age ratings',
    body:
      'Every ticket admits one person to one screening or session. Age ratings are enforced at the door and photo ID may be asked for at 15 and 18 screenings. Anyone under 12 comes with an adult.',
  },
  {
    id: 'pol_latecomers',
    title: 'Latecomers',
    body:
      'Doors close when the film starts. Latecomers are seated at a suitable break where there is one, and at the back where there is not. For galas and awards nights there is no admission after the start.',
  },
  {
    id: 'pol_refunds',
    title: 'Refunds and exchanges',
    body:
      'Tickets can be exchanged for another screening up to 24 hours before the one you hold, subject to seats. Refunds are given when a screening is cancelled or moved to a time you cannot make. Passes are not refundable once the festival has opened.',
  },
  {
    id: 'pol_changes',
    title: 'Changes to the programme',
    body:
      'Films, times and venues can change; prints arrive late and guests miss flights. Changes are posted to Updates, and anything affecting a ticket you hold is flagged in the app.',
  },
  {
    id: 'pol_recording',
    title: 'Photography and recording',
    body:
      'No photography or recording of any kind during a screening. Phones stay away and screens stay dark. Press and accredited photographers work to their own arrangements with the festival.',
  },
  {
    id: 'pol_bags',
    title: 'Bags and security',
    body:
      'Bags are searched at every venue. Large bags, outside food and drink, and anything that could be used as a weapon are not allowed in. Cloakrooms are available at Landmark and Eko Hotel.',
  },
  {
    id: 'pol_conduct',
    title: 'Code of conduct',
    body:
      'The festival is for everybody. Harassment of any kind, of attendees, guests or staff, ends in removal without a refund. Tell any member of staff, or use the contact details below, and it will be dealt with.',
  },
  {
    id: 'pol_privacy',
    title: 'Filming at the festival',
    body:
      'The festival films and photographs its own events, including audiences, for its records and publicity. Tell the door staff if you would rather not appear and they will seat you away from the cameras.',
  },
]

export const contact: ContactInfo = {
  email: festival.supportEmail,
  phone: '+234 700 000 0000',
  whatsapp: '+234 700 000 0000',
  hours: 'Every day of the festival, 09:00 to 21:00. Outside the festival, weekdays 09:00 to 17:00.',
  inPerson: 'The festival desk in the main atrium at Landmark Centre, and at the entrance of every other venue.',
}
