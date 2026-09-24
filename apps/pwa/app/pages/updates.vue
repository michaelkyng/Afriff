<script setup lang="ts">
import { BellIcon, CalendarClockIcon, CheckCheckIcon, MapPinIcon, MegaphoneIcon } from 'lucide-vue-next'
import type { Component } from 'vue'
import type { UpdateKind } from '@afriff/api'

/**
 * Everything the festival has said, newest first, with what concerns this
 * attendee marked. Reading is per device: the badge should be right for someone
 * who never signs in.
 */
useHead({ title: 'Updates' })

const { published, unread, isMine, inbox } = useUpdates()

const icons: Record<UpdateKind, Component> = {
  schedule: CalendarClockIcon,
  venue: MapPinIcon,
  announcement: MegaphoneIcon,
}
const kindLabels: Record<UpdateKind, string> = {
  schedule: 'Schedule',
  venue: 'Venue',
  announcement: 'Announcement',
}

function markAll() {
  inbox.markAllRead(published.value.map((update) => update.id))
}
</script>

<template>
  <div class="mx-auto max-w-2xl space-y-6">
    <AppPageHeader
      title="Updates"
      description="Schedule and venue changes, and news from the festival."
      :meta="unread ? `${unread} unread` : undefined"
    >
      <template #actions>
        <UiButton v-if="unread" variant="secondary" size="sm" @click="markAll">
          <CheckCheckIcon aria-hidden="true" />
          Mark all read
        </UiButton>
      </template>
    </AppPageHeader>

    <UiEmptyState
      v-if="!published.length"
      :icon="BellIcon"
      title="Nothing yet"
      description="Schedule changes, venue notices and announcements land here as the festival goes on."
    >
      <UiButton to="/programme">Browse the programme</UiButton>
    </UiEmptyState>

    <ul v-else class="space-y-2">
      <li v-for="update in published" :key="update.id">
        <article
          class="card p-4 md:p-5"
          :class="[
            !inbox.isRead(update.id) && 'border-line-strong',
            update.severity === 'urgent' && !inbox.isRead(update.id) && 'border-danger/35',
          ]"
        >
          <div class="flex items-start gap-3">
            <span
              class="mt-0.5 grid size-8 shrink-0 place-items-center rounded-tile border border-line bg-raised"
              :class="update.severity === 'urgent' ? 'text-danger' : 'text-muted'"
              aria-hidden="true"
            >
              <component :is="icons[update.kind]" class="size-4" :stroke-width="1.75" />
            </span>

            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-1.5 text-meta text-muted">
                <span>{{ kindLabels[update.kind] }}</span>
                <span aria-hidden="true">·</span>
                <span class="tabular-nums">{{ formatDay(update.publishedAt) }}, {{ formatTime(update.publishedAt) }}</span>
                <UiBadge v-if="update.severity === 'urgent'" tone="danger">Urgent</UiBadge>
                <UiBadge v-if="isMine(update)" tone="accent">Affects you</UiBadge>
                <span
                  v-if="!inbox.isRead(update.id)"
                  class="ml-auto size-2 shrink-0 rounded-full bg-accent"
                  :aria-label="`${update.title} is unread`"
                />
              </div>

              <h2 class="mt-1 leading-snug font-semibold" :class="inbox.isRead(update.id) && 'text-muted'">
                {{ update.title }}
              </h2>
              <p class="mt-1 text-meta text-muted">{{ update.body }}</p>

              <div class="mt-3 flex flex-wrap items-center gap-2">
                <UiButton v-if="update.link" :to="update.link" size="sm" variant="secondary">Take a look</UiButton>
                <UiButton v-if="!inbox.isRead(update.id)" size="sm" variant="ghost" @click="inbox.markRead(update.id)">
                  Mark read
                </UiButton>
              </div>
            </div>
          </div>
        </article>
      </li>
    </ul>

    <p class="px-1 text-meta text-muted">
      What you have read is remembered on this device. Nothing is emailed or pushed while the app is local.
    </p>
  </div>
</template>
