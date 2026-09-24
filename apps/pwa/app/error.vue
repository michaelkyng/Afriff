<script setup lang="ts">
import type { NuxtError } from '#app'
import { CompassIcon } from 'lucide-vue-next'

const props = defineProps<{ error: NuxtError }>()
const session = useSessionStore()

const notFound = computed(() => props.error.statusCode === 404)
useHead({ title: notFound.value ? 'Page not found' : 'Something went wrong' })
</script>

<template>
  <NuxtLayout :name="session.isSignedIn ? 'default' : 'auth'">
    <UiEmptyState
      :icon="CompassIcon"
      :title="notFound ? 'This page isn’t in the programme' : 'Something went wrong'"
      :description="
        notFound
          ? 'The link may be old, or the page may have moved.'
          : 'Please try again. If it keeps happening, let us know.'
      "
    >
      <UiButton @click="clearError({ redirect: session.isSignedIn ? '/' : '/signin' })">
        {{ session.isSignedIn ? 'Back to home' : 'Sign in' }}
      </UiButton>
    </UiEmptyState>
  </NuxtLayout>
</template>
