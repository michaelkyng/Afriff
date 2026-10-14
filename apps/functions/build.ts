/**
 * Bundles the functions into `dist/`, which is what the emulators load and what
 * `firebase deploy` uploads (see `firebase.json`).
 *
 * Firebase installs a function's dependencies with npm in the cloud, and npm
 * cannot resolve this repo's `workspace:*` packages. So the shared packages
 * (`@afriff/api`, `@afriff/validation`, zod) are bundled in, and
 * `dist/package.json` lists only what stays external: the Firebase SDKs, at the
 * versions pinned in this package.
 *
 *   bun build.ts           build once
 *   bun build.ts --watch   rebuild on changes; the emulators reload on their own
 */
import { cpSync, readdirSync, readFileSync, rmSync, watch, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = import.meta.dir
const dist = join(root, 'dist')
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
  dependencies: Record<string, string>
  engines: Record<string, string>
}
const EXTERNAL = ['firebase-admin', 'firebase-functions']

async function build(): Promise<boolean> {
  const result = await Bun.build({
    entrypoints: [join(root, 'src/index.ts')],
    outdir: dist,
    target: 'node',
    format: 'esm',
    sourcemap: 'linked',
    external: EXTERNAL.flatMap((name) => [name, `${name}/*`]),
  })
  if (!result.success) {
    for (const log of result.logs) console.error(log)
    return false
  }

  const deployManifest = {
    name: 'afriff-functions',
    private: true,
    type: 'module',
    main: 'index.js',
    engines: manifest.engines,
    dependencies: Object.fromEntries(EXTERNAL.map((name) => [name, manifest.dependencies[name]])),
  }
  writeFileSync(join(dist, 'package.json'), `${JSON.stringify(deployManifest, null, 2)}\n`)

  // Firebase reads parameters (.env*) and emulator secrets (.secret.local) from beside the code.
  for (const file of readdirSync(root)) {
    if (/^\.(env|secret)/.test(file) && !file.endsWith('.example')) cpSync(join(root, file), join(dist, file))
  }
  return true
}

rmSync(dist, { recursive: true, force: true })
const ok = await build()

if (process.argv.includes('--watch')) {
  const sources = [join(root, 'src'), join(root, '../../packages/api/src'), join(root, '../../packages/validation/src')]
  let timer: ReturnType<typeof setTimeout> | undefined
  for (const source of sources) {
    watch(source, { recursive: true }, () => {
      clearTimeout(timer)
      timer = setTimeout(async () => {
        if (await build()) console.log(`[functions] rebuilt ${new Date().toLocaleTimeString()}`)
      }, 150)
    })
  }
  console.log('[functions] watching for changes')
}
else {
  if (!ok) process.exit(1)
  console.log('[functions] bundled into dist/')
}
