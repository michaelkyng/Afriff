<template>
  <div class="min-h-dvh md:flex">
    <a
      href="#main"
      class="sr-only z-[60] rounded-full bg-accent px-4 py-2 font-semibold text-on-accent focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
    >
      Skip to content
    </a>

    <AppSidebar />

    <div class="flex min-h-dvh min-w-0 flex-1 flex-col">
      <AppHeader />
      <AppTopBar />
      <AppOfflineBanner />
      <main id="main" class="mx-auto w-full max-w-6xl flex-1 px-4 pt-5 pb-32 md:px-8 md:pt-8 md:pb-16">
        <slot />
      </main>
    </div>

    <AppTabBar />
    <AppPwaPrompts />
  </div>
</template>
