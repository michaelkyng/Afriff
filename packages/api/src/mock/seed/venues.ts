import type { Venue } from '../../types'

/** MOCK DATA — venue details are placeholders; confirm addresses and screens with the festival team. */
export const venues: Venue[] = [
  {
    id: 'ven_landmark',
    slug: 'landmark-centre',
    name: 'Landmark Centre',
    shortName: 'Landmark',
    area: 'Oniru, Victoria Island',
    address: 'Water Corporation Drive, Oniru, Victoria Island, Lagos',
    mapsUrl: 'https://maps.google.com/?q=Landmark+Centre+Victoria+Island+Lagos',
    screens: [
      { id: 'scr_lm_1', name: 'Cinema 1', capacity: 240 },
      { id: 'scr_lm_2', name: 'Cinema 2', capacity: 180 },
      { id: 'scr_lm_3', name: 'Cinema 3', capacity: 120 },
    ],
    accessibility: ['Step-free access', 'Accessible toilets', 'Wheelchair spaces in all cinemas'],
    accessibilityNote:
      'Wheelchair spaces are held until 20 minutes before each screening. Ask at the festival desk in the main atrium and someone will take you through.',
    travel: {
      landmark: 'Behind the Oniru beachfront, off Water Corporation Drive.',
      parking: 'Paid multi-storey car park on site. It fills from about 17:00 on weekends.',
      dropOff: 'Drop-off bay at the main entrance on Water Corporation Drive.',
      transport: 'Ride-hailing is straightforward here; drivers know Landmark by name.',
      timing: 'Allow an extra 30 minutes from the mainland on a weekday evening.',
    },
  },
  {
    id: 'ven_twinwaters',
    slug: 'twin-waters',
    name: 'Twin Waters Entertainment Centre',
    shortName: 'Twin Waters',
    area: 'Lekki',
    address: 'Lekki, Lagos',
    mapsUrl: 'https://maps.google.com/?q=Twin+Waters+Lekki+Lagos',
    screens: [
      { id: 'scr_tw_a', name: 'Screen A', capacity: 200 },
      { id: 'scr_tw_b', name: 'Screen B', capacity: 150 },
    ],
    accessibility: ['Step-free access', 'Accessible toilets'],
    accessibilityNote: 'Both screens are on one level. Tell the door staff if you need a seat near an exit.',
    travel: {
      landmark: 'On the Lekki-Epe Expressway service lane, past the second roundabout.',
      parking: 'Free parking on site, and overflow parking across the service lane.',
      dropOff: 'Drop-off at the gate; the walk to the screens is level and short.',
      transport: 'Buses along the expressway stop within five minutes’ walk.',
      timing: 'Lekki traffic is worst between 16:00 and 19:00 — leave earlier than feels necessary.',
    },
  },
  {
    id: 'ven_terrakulture',
    slug: 'terra-kulture',
    name: 'Terra Kulture',
    shortName: 'Terra Kulture',
    area: 'Victoria Island',
    address: 'Tiamiyu Savage Street, Victoria Island, Lagos',
    mapsUrl: 'https://maps.google.com/?q=Terra+Kulture+Victoria+Island+Lagos',
    screens: [{ id: 'scr_tk_theatre', name: 'Theatre', capacity: 160 }],
    accessibility: ['Step-free access to ground floor', 'Accessible toilets'],
    accessibilityNote:
      'The theatre is on the ground floor and step-free. The upstairs gallery, used for some masterclasses, is reached by stairs only — ask at the desk and the session can be moved down.',
    travel: {
      landmark: 'Tiamiyu Savage, a few minutes from Ahmadu Bello Way.',
      parking: 'A small car park that fills before evening screenings; overflow two streets down.',
      dropOff: 'Drop-off directly outside the entrance.',
      transport: 'Easy by ride-hailing; the street is narrow, so meet your driver at the gate.',
    },
  },
  {
    id: 'ven_eko',
    slug: 'eko-hotel',
    name: 'Eko Hotel & Suites',
    shortName: 'Eko Hotel',
    area: 'Victoria Island',
    address: 'Adetokunbo Ademola Street, Victoria Island, Lagos',
    mapsUrl: 'https://maps.google.com/?q=Eko+Hotel+and+Suites+Lagos',
    screens: [{ id: 'scr_eko_hall', name: 'Expo Hall', capacity: 900 }],
    accessibility: ['Step-free access', 'Accessible toilets', 'Reserved accessible seating'],
    accessibilityNote:
      'Reserved accessible seating in the Expo Hall is held on the aisle. Say so when you arrive at the red carpet entrance and you will be taken round the queue.',
    travel: {
      landmark: 'Adetokunbo Ademola Street, opposite the Eko Atlantic gate.',
      parking: 'Hotel car park, free for guests of the festival with a ticket.',
      dropOff: 'Red carpet entrance on gala nights; main lobby otherwise.',
      transport: 'Ride-hailing drops at the lobby. Security checks bags on the way in.',
      timing: 'On gala nights the approach road backs up from 17:30. Doors are at 18:00.',
    },
  },
]
