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
  },
]
