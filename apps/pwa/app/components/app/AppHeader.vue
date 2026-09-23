<template>
  <header class="pt-safe sticky top-0 z-40 border-b border-line bg-chrome backdrop-blur-xl md:hidden">
    <div class="flex h-14 items-center gap-4 px-4">
      <NuxtLink to="/" aria-label="AFRIFF home" class="rounded-lg">
        <AppLogo />
      </NuxtLink>
      <div class="ml-auto shrink-0">
        <AppNotifications />
      </div>
    </div>
  </header>
</template>
