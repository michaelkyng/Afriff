import { logger } from 'firebase-functions'
import { onSchedule } from 'firebase-functions/scheduler'
import type { OrderDoc } from '@afriff/api/firebase/schema'
import { collections } from './admin'
import { PAYSTACK_SECRET_KEY } from './env'
import { expireOrder } from './orders'

/**
 * Puts the stock of unpaid orders back on sale once their hold has run out.
 * Each one is checked with Paystack first, so a payment whose webhook went
 * missing is settled rather than expired.
 */
export const expireOrders = onSchedule(
  { schedule: 'every 10 minutes', timeZone: 'Africa/Lagos', secrets: [PAYSTACK_SECRET_KEY] },
  async () => {
    const stale = await collections
      .orders()
      .where('status', '==', 'pending')
      .where('holdExpiresAt', '<', new Date().toISOString())
      .limit(200)
      .get()

    const outcomes = { settled: 0, expired: 0, waiting: 0, errors: 0 }
    for (const doc of stale.docs) {
      try {
        outcomes[await expireOrder(doc.data() as OrderDoc)] += 1
      }
      catch (error) {
        outcomes.errors += 1
        logger.error('Could not expire an order', { orderId: doc.id, error })
      }
    }
    if (stale.size) logger.info('Expired unpaid orders', outcomes)
  },
)
