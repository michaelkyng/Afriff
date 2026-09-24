<template>
  <div class="flex min-h-dvh flex-col justify-center px-4 py-8 md:px-8">
    <AppOfflineBanner />
    <main id="main" class="mx-auto w-full max-w-sm">
      <slot />
    </main>
  </div>
</template>
