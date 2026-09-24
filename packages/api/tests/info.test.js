import { describe, expect, test } from 'bun:test'
import { createMockApi } from '@afriff/api/mock'

const api = createMockApi({ latency: 0 })
const TOPICS = ['tickets', 'at-the-festival', 'access', 'getting-there']

describe('info.get', () => {
  test('comes back whole, and without an account', async () => {
    const info = await api.info.get()
    expect(info.faqs.length).toBeGreaterThan(10)
    expect(info.policies.length).toBeGreaterThan(5)
    expect(info.contact.email).toContain('@')
    expect(info.contact.hours).toBeTruthy()
  })

  test('every topic has questions, and every answer says something', async () => {
    const { faqs } = await api.info.get()
    for (const topic of TOPICS) {
      expect(faqs.filter((faq) => faq.topic === topic).length).toBeGreaterThan(2)
    }
    for (const faq of faqs) {
      expect(TOPICS).toContain(faq.topic)
      expect(faq.question.endsWith('?')).toBe(true)
      expect(faq.answer.length).toBeGreaterThan(40)
      if (faq.link) {
        expect(faq.link.startsWith('/')).toBe(true)
        expect(faq.linkLabel).toBeTruthy()
      }
    }
  })

  test('ids are unique, so nothing collides in a list key', async () => {
    const { faqs, policies } = await api.info.get()
    expect(new Set(faqs.map((faq) => faq.id)).size).toBe(faqs.length)
    expect(new Set(policies.map((policy) => policy.id)).size).toBe(policies.length)
  })

  test('the policies an attendee is owed before buying are all there', async () => {
    const { policies } = await api.info.get()
    const titles = policies.map((policy) => policy.title.toLowerCase()).join(' | ')
    for (const subject of ['admission', 'latecomers', 'refunds', 'recording', 'conduct']) {
      expect(titles).toContain(subject)
    }
    for (const policy of policies) expect(policy.body.length).toBeGreaterThan(60)
  })

  test('the contact email is the one the festival publishes', async () => {
    const [info, festival] = await Promise.all([api.info.get(), api.festival.get()])
    expect(info.contact.email).toBe(festival.supportEmail)
  })
})

describe('venues', () => {
  test('each one says how to get there and what access it has', async () => {
    const venues = await api.programme.listVenues()
    expect(venues.length).toBeGreaterThan(3)
    for (const venue of venues) {
      expect(venue.accessibility.length).toBeGreaterThan(0)
      expect(venue.accessibilityNote).toBeTruthy()
      expect(venue.travel).toBeTruthy()
      expect(venue.travel.parking).toBeTruthy()
      expect(venue.travel.landmark).toBeTruthy()
      expect(venue.mapsUrl.startsWith('https://')).toBe(true)
    }
  })
})
