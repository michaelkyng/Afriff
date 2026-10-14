/**
 * AFRIFF Cloud Functions (2nd gen). Every export here is deployed.
 *
 * - Buying: `checkout`, `payOrder`, `verifyOrder` (callable), `paystackWebhook`
 *   (HTTPS, called by Paystack) and `expireOrders` (every 10 minutes).
 * - Tickets: `transferTicket`, `claimTickets` (callable).
 * - The door: `checkIn` (callable, festival staff only).
 * - Email: `sendMail` delivers the `mail` outbox through Brevo.
 */
import './env'

export { checkout, payOrder, verifyOrder } from './orders'
export { paystackWebhook } from './webhook'
export { expireOrders } from './expire'
export { transferTicket, claimTickets } from './tickets'
export { checkIn } from './door'
export { sendMail } from './mail/outbox'
