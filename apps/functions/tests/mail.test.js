import { describe, expect, test } from 'bun:test'
import { BrevoError, sendWithBrevo } from '../src/mail/brevo.ts'
import { escapeHtml, orderPaidMail, renderMail, ticketReceivedMail } from '../src/mail/templates.ts'

const APP = 'https://app.example.com'

const order = {
  id: 'ord_1',
  reference: 'AF-7KQ2P',
  contact: { name: 'Ada <b>Okoye</b>', email: 'ada@example.com' },
  lines: [
    { title: 'Salt Roads', detail: 'Tue 3 Nov, 18:30 · Landmark', quantity: 2, unitPrice: { amount: 4_000_00, currency: 'NGN' } },
    { title: 'Festival Pass', quantity: 1, unitPrice: { amount: 75_000_00, currency: 'NGN' } },
  ],
  total: { amount: 83_000_00, currency: 'NGN' },
}

describe('the order confirmation', () => {
  const draft = orderPaidMail(order, 3)
  const mail = renderMail(draft.template, draft.params, { appUrl: APP })

  test('goes to the contact on the order, about that order', () => {
    expect(draft.to).toEqual({ email: 'ada@example.com', name: 'Ada <b>Okoye</b>' })
    expect(mail.subject).toBe('Your AFRIFF tickets are ready (AF-7KQ2P)')
  })

  test('lists what was bought, each line priced the way the app shows it, and the total', () => {
    for (const part of [mail.html, mail.text]) {
      expect(part).toContain('Salt Roads')
      expect(part).toContain('Festival Pass')
      // Two seats at ₦4,000 are ₦8,000, never "2 × ₦8,000".
      expect(part).toContain('2 × ₦4,000')
      expect(part).toContain('₦8,000')
      expect(part).not.toContain('2 × ₦8,000')
      expect(part).toContain('83,000')
    }
    expect(mail.text).toContain('3 tickets are waiting')
  })

  test('links to the attendee’s tickets and to the order', () => {
    expect(mail.html).toContain(`href="${APP}/tickets?view=mine"`)
    expect(mail.text).toContain(`${APP}/orders/ord_1`)
  })

  test('escapes whatever came from outside', () => {
    expect(mail.html).not.toContain('<b>Okoye</b>')
    expect(mail.html).toContain('Hi Ada')
    expect(escapeHtml(`<script>alert("x")</script>&'`)).toBe('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;&amp;&#39;')
  })

  test('follows the copy rules: no em or en dashes', () => {
    expect(`${mail.subject}${mail.html}${mail.text}`).not.toMatch(/[–—]/)
  })
})

describe('the ticket hand-over email', () => {
  test('tells someone with an account where the ticket is', () => {
    const draft = ticketReceivedMail({ email: 'bem@example.com', name: 'Bem Tersoo' }, {
      fromName: 'Ada Okoye',
      toName: 'Bem Tersoo',
      title: 'Salt Roads',
      detail: 'Tue 3 Nov, 18:30',
      hasAccount: true,
    })
    const mail = renderMail(draft.template, draft.params, { appUrl: APP })
    expect(mail.subject).toBe('Ada Okoye sent you a ticket to Salt Roads')
    expect(mail.text).toContain('already in the app')
    expect(mail.html).toContain(`href="${APP}/tickets?view=mine"`)
  })

  test('asks someone without one to sign up with that address and confirm it', () => {
    const draft = ticketReceivedMail({ email: 'bem@example.com' }, { fromName: 'Ada Okoye', title: 'Salt Roads', hasAccount: false })
    const mail = renderMail(draft.template, draft.params, { appUrl: APP })
    expect(mail.text).toContain('Hi there')
    expect(mail.text).toContain('confirm it')
    expect(mail.html).toContain(`href="${APP}/signup"`)
  })
})

describe('sending through Brevo', () => {
  const message = {
    sender: { email: 'tickets@example.com', name: 'AFRIFF' },
    to: [{ email: 'ada@example.com' }],
    subject: 'Hello',
    htmlContent: '<p>Hello</p>',
    textContent: 'Hello',
  }

  const answering = (status, body) => {
    const calls = []
    const fetchImpl = async (url, init) => {
      calls.push({ url, init })
      return new Response(JSON.stringify(body), { status })
    }
    return { fetchImpl, calls }
  }

  test('posts the message with the API key and returns Brevo’s message id', async () => {
    const { fetchImpl, calls } = answering(201, { messageId: '<abc@smtp-relay.mailin.fr>' })
    expect(await sendWithBrevo('xkeysib-test', message, fetchImpl)).toEqual({ messageId: '<abc@smtp-relay.mailin.fr>' })
    expect(calls[0].url).toBe('https://api.brevo.com/v3/smtp/email')
    expect(calls[0].init.headers['api-key']).toBe('xkeysib-test')
    expect(JSON.parse(calls[0].init.body)).toEqual(message)
  })

  test('retries rate limits and server errors, but not a bad request or key', async () => {
    for (const [status, retryable] of [[429, true], [500, true], [503, true], [400, false], [401, false]]) {
      const { fetchImpl } = answering(status, { code: 'x', message: `status ${status}` })
      const error = await sendWithBrevo('xkeysib-test', message, fetchImpl).catch((caught) => caught)
      expect(error).toBeInstanceOf(BrevoError)
      expect(error).toMatchObject({ status, retryable, message: `status ${status}` })
    }
  })
})
