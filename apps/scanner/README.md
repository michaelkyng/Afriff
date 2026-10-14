# AFRIFF Door

The ticket scanner for festival staff. Door staff sign in, pick the screening or
event they are checking people into, and scan tickets with the phone's camera,
or type the printed code when a QR code will not read. Each scan gets a
full-screen answer in a colour that reads from across a lobby, a sound and a
vibration, and the door shows a running count, live across every phone
scanning the same session.

Like the attendee app, it runs on the local mock or on Firebase
(`NUXT_PUBLIC_API_MODE`), through one contract: `DoorApi` in
[`@afriff/api/door`](../../packages/api/src/door.ts).

## Running it

From the repository root:

```sh
bun run dev:scanner        # http://localhost:3001
```

**Mock mode** (the default) needs nothing else. Sign in with the demo door
account (`door@afriff.test` / `door-demo-1`, offered on the sign-in screen). The
scanner runs on its own origin, so it cannot see tickets bought in the attendee
app's mock: each session instead comes with demo tickets of every kind (the
"Demo" button), which go through the same rules a real scan does.

**Against the emulators:** start them (`bun run emulators`, `bun run emulators:seed`),
give yourself a door account, and set the emulator lines from `.env.example` in
`apps/scanner/.env`:

```sh
bun run staff -- --email door@afriff.test --role door --name "Landmark door"
```

Buy a ticket in the attendee app pointed at the same emulators, then scan its
QR code from the ticket page, or type its code.

**The camera** needs a secure page: `localhost` works, but a phone on your
network opening `http://192.168.…` does not. Use an HTTPS tunnel to try it on a
phone during development.

## Rehearsing festival week

Seed sessions are in November 2026, so the doors are closed most of the year.
The **rehearsal clock** on the session list sets the door to a moment in
festival week. It is offered only where the API honours it: the mock, and the
Firebase emulators. A deployed `checkIn` function always uses the real time, so
the control does not appear against a real project.

## The rules

Every scan is judged by `decideCheckIn` in `@afriff/api/door`, shared by the
mock and the `checkIn` Cloud Function. In order:

| Outcome | When |
| --- | --- |
| Doors not open yet | More than 60 minutes before the start |
| Has ended | After the end |
| Not a festival ticket | No ticket with that code, or a QR code whose code does not match its ticket |
| Passed on / Cancelled | The ticket was transferred or voided |
| Not for this screening or event | A ticket for somewhere else (below) |
| Already checked in | It came in here before; the screen says when and by whom |
| No seats left for passes | A pass, and every seat not sold as a single ticket is taken |
| Admitted | Everything else |

What admits where: a **festival pass** covers standard screenings, panels and the
Filmmakers' Mixer; a **day pass** covers that day's standard screenings and
panels; a **single ticket** covers its screening; **galas, masterclasses and the
awards** need their own ticket, and a gala screening is entered on its gala's
ticket. A single ticket is marked used when it comes in, and the attendee's app
shows when; a pass stays valid for the next session.

On the server, each scan reads the ticket, its check-in for the session and the
running count in one Firestore transaction, so two doors scanning the same
ticket at the same moment let it in once.

## Layout

```
app/
  pages/signin.vue             staff sign-in
  pages/index.vue              choose a door: day, venue, search, doors open / later / ended
  pages/scan/[kind]/[id].vue   the scanner for one screening or event
  components/
    CameraView.vue             camera, framing, torch, and what to do when the camera cannot start
    ScanResult.vue             the full-screen verdict
    CodeEntrySheet.vue         typing a printed code
    DemoTicketsSheet.vue       mock mode's tickets to try
    SessionRow.vue, RehearsalClock.vue
  composables/
    useQrScanner.ts            jsQR from the first frame; the browser's BarcodeDetector once it has warmed up
    useFeedback.ts             tones and vibration (mute on the scanner)
    useDoorClock.ts            the rehearsal clock
    useDoor.ts                 the API, the signed-in staff member, the session list
  utils/outcomes.ts            the words for each outcome
  utils/sessions.ts            grouping and counting for the session list
```

## Decisions

| Decision | Why |
| --- | --- |
| A separate app, not a route in the attendee app | Different people, different sign-in, different install on a different phone. Shares the UI kit and the API package. |
| jsQR first, then the native detector | Chrome's `BarcodeDetector` copes better with glare and worn printouts, but its first call took 5 seconds (loading its model). jsQR reads meanwhile; Safari has no native detector and stays on jsQR. |
| Dark only | Lobbies are dim, and a door phone has to last the day. |
| The screen stays awake while scanning | A phone that locks mid-queue costs a minute each time (`useWakeLock`). |
| Good results clear themselves; others wait for "Next" | Staff should read a refusal before scanning the next person. |
| Recent scans kept in memory only | Enough for "I was just here", without leaving names on a shared phone. |
| Online only, for now | Offline scanning (download the list, sync later) is roadmap phase 9. |
