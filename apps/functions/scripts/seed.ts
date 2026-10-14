/**
 * Loads the festival, programme, catalogue, info and updates into Firestore,
 * with the Admin SDK (the rules let nobody else write them).
 *
 *   bun run emulators:seed                                  the local emulators
 *   bun run emulators:seed -- --project <id> --yes          a real project
 *
 * The data is the placeholder seed from `@afriff/api/seed`: fictional, for
 * development and staging. A real edition is loaded the same way from its own
 * data. Seeding resets stock (`remaining`, `sold`), so a project that has taken
 * orders is refused unless `--force` is given as well.
 */
import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { COLLECTIONS, CURRENT } from '@afriff/api/firebase/schema'
import * as seed from '@afriff/api/seed'

const args = process.argv.slice(2)
const option = (name: string) => {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : undefined
}

const projectId = option('--project') ?? 'demo-afriff'
const emulated = projectId.startsWith('demo-')

if (emulated) {
  process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080'
}
else {
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    console.error(`FIRESTORE_EMULATOR_HOST is set, so "${projectId}" would be seeded in the emulator. Unset it first.`)
    process.exit(1)
  }
  if (!args.includes('--yes')) {
    console.error(`This writes placeholder data to the real project "${projectId}". Run again with --yes if that is what you want.`)
    process.exit(1)
  }
}

const db = getFirestore(initializeApp({ projectId }))

if (!emulated && !args.includes('--force')) {
  const orders = await db.collection(COLLECTIONS.orders).limit(1).get()
  if (!orders.empty) {
    console.error(`"${projectId}" has orders, and seeding would reset its stock. Add --force only if you mean it.`)
    process.exit(1)
  }
}

const writer = db.bulkWriter()
let count = 0

/** Keeps the seed's order: Firestore returns documents by id, the app sorts by `position`. */
function putAll(collection: string, items: readonly { id: string }[]) {
  items.forEach((item, position) => {
    writer.set(db.collection(collection).doc(item.id), { ...item, position })
    count += 1
  })
}

writer.set(db.collection(COLLECTIONS.festival).doc(CURRENT), seed.festival)
writer.set(db.collection(COLLECTIONS.info).doc(CURRENT), { faqs: seed.faqs, policies: seed.policies, contact: seed.contact })
count += 2
putAll(COLLECTIONS.venues, seed.venues)
putAll(COLLECTIONS.sections, seed.sections)
putAll(COLLECTIONS.films, seed.films)
putAll(COLLECTIONS.screenings, seed.screenings)
putAll(COLLECTIONS.events, seed.events)
putAll(COLLECTIONS.products, seed.products)
putAll(COLLECTIONS.updates, seed.updates)

await writer.close()
console.log(`Seeded ${count} documents into ${emulated ? `the emulator (${projectId})` : projectId}.`)
