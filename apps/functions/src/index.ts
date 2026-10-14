/**
 * AFRIFF Cloud Functions (2nd gen). Every export here is deployed.
 *
 * - Buying: `checkout`, `payOrder`, `verifyOrder` (callable), `paystackWebhook`
 *   (HTTPS, called by Paystack) and `expireOrders` (every 10 minutes).
 * - Tickets: `transferTicket`, `claimTickets` (callable).
 * - Email: `sendMail` delivers the `mail` outbox through Brevo.
 */
import './env'

export { checkout, payOrder, verifyOrder } from './orders'
export { paystackWebhook } from './webhook'
export { expireOrders } from './expire'
export { transferTicket, claimTickets } from './tickets'
export { sendMail } from './mail/outbox'
