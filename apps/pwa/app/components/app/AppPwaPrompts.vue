<script setup lang="ts">
import { DownloadIcon, RefreshCwIcon, XIcon } from 'lucide-vue-next'

const pwa = usePWA()

const showUpdate = computed(() => Boolean(pwa?.needRefresh))
const showInstall = computed(() => Boolean(pwa?.showInstallPrompt && !pwa?.needRefresh))
</script>

<template>
  <div
    class="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] z-50 flex justify-center px-4 md:bottom-6"
    aria-live="polite"
  >
    <Transition
      enter-active-class="transition-[opacity,translate] duration-300 ease-out"
      enter-from-class="translate-y-3 opacity-0"
      leave-active-class="transition-[opacity,translate] duration-150 ease-out"
      leave-to-class="translate-y-2 opacity-0"
      mode="out-in"
    >
      <div
        v-if="showUpdate"
        key="update"
        class="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-card border border-line bg-surface p-2.5 pl-4 shadow-pop"
      >
        <RefreshCwIcon class="size-5 shrink-0 text-accent-ink" aria-hidden="true" />
        <p class="flex-1 text-meta font-medium">A new version of the app is ready.</p>
        <UiButton size="sm" variant="ghost" @click="pwa?.cancelPrompt()">Later</UiButton>
        <UiButton size="sm" @click="pwa?.updateServiceWorker(true)">Reload</UiButton>
      </div>

      <div
        v-else-if="showInstall"
        key="install"
        class="pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-card border border-line bg-surface p-4 shadow-pop"
      >
        <AppLogo :show-wordmark="false" />
        <div class="flex-1">
          <p class="font-semibold">Install the AFRIFF app</p>
          <p class="mt-0.5 text-meta text-muted">Quick access to your tickets, even without data.</p>
          <div class="mt-3 flex gap-2">
            <UiButton size="sm" @click="pwa?.install()">
              <DownloadIcon aria-hidden="true" />
              Install
            </UiButton>
            <UiButton size="sm" variant="ghost" @click="pwa?.cancelInstall()">Not now</UiButton>
          </div>
        </div>
        <button
          type="button"
          class="pressable -m-1 grid size-8 place-items-center rounded-full text-muted hover:bg-hover hover:text-ink"
          aria-label="Dismiss"
          @click="pwa?.cancelInstall()"
        >
          <XIcon class="size-4" />
        </button>
      </div>
    </Transition>
  </div>
</template>
