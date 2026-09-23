import type { Section } from '../../types'

/** MOCK DATA — programme sections. */
export const sections: Section[] = [
  {
    id: 'sec_feature',
    slug: 'feature-competition',
    name: 'Feature Competition',
    kind: 'competition',
    description: 'Feature-length fiction competing for the Globe Awards.',
    hue: 42,
  },
  {
    id: 'sec_documentary',
    slug: 'documentary-competition',
    name: 'Documentary Competition',
    kind: 'competition',
    description: 'Documentaries from across the continent and the diaspora.',
    hue: 190,
  },
  {
    id: 'sec_shorts',
    slug: 'short-film-competition',
    name: 'Short Film Competition',
    kind: 'competition',
    description: 'Bold short films under 40 minutes.',
    hue: 330,
  },
  {
    id: 'sec_animation',
    slug: 'animation',
    name: 'Animation',
    kind: 'competition',
    description: 'Hand-drawn, stop-motion and CG animation from African studios.',
    hue: 265,
  },
  {
    id: 'sec_student',
    slug: 'student-films',
    name: 'Student Films',
    kind: 'competition',
    description: 'The next generation: work from film schools and academies.',
    hue: 150,
  },
  {
    id: 'sec_nollywood',
    slug: 'nollywood-now',
    name: 'Nollywood Now',
    kind: 'showcase',
    description: 'The best of new Nigerian cinema, out of competition.',
    hue: 12,
  },
  {
    id: 'sec_special',
    slug: 'special-screenings',
    name: 'Special Screenings',
    kind: 'special',
    description: 'Galas, restorations and one-off events.',
    hue: 50,
  },
]
