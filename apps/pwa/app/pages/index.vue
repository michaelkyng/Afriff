<script setup lang="ts">
import { RefreshCwIcon } from 'lucide-vue-next'

const {
  festival,
  programme,
  lookups,
  pending,
  error,
  refresh,
  now,
  phase,
  today,
  countdown,
  isSimulated,
  liveItems,
  upNextDay,
  upNext,
  upNextTitle,
  todayCount,
  featured,
  sections,
  fromPrice,
  venuesToday,
  dontMiss,
} = useHomeFeed()

/** Laptops get a dashboard (feed + side rail); phones and tablets get one column. */
const isWide = useMediaQuery('(min-width: 1024px)')
</script>

<template>
  <div class="space-y-10 lg:space-y-8">
    <HomeHero
      :festival="festival"
      :phase="phase"
      :today="today"
      :countdown="countdown"
      :is-simulated="isSimulated"
      :venue-count="programme?.venues.length"
      :today-count="todayCount"
    />

    <UiEmptyState
      v-if="error && !programme"
      :icon="RefreshCwIcon"
      title="We couldn’t load the programme"
      description="Check your connection and try again."
    >
      <UiButton variant="secondary" @click="refresh()">Try again</UiButton>
    </UiEmptyState>

    <!-- Laptop: dashboard -->
    <div v-else-if="isWide" class="grid grid-cols-[minmax(0,1fr)_20rem] gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div class="min-w-0 space-y-10">
        <HomeNowNext
          :now="now"
          :today="today"
          :live-items="liveItems"
          :up-next="upNext"
          :up-next-title="upNextTitle"
          :up-next-day="upNextDay"
          :pending="pending"
        />
        <HomeFeatured :films="featured" :lookups="lookups" :pending="pending" />
        <HomeSections :sections="sections" :pending="pending" />
      </div>

      <aside class="space-y-8" aria-label="Festival essentials">
        <HomeQuickLinks :from-price="fromPrice" :venue-count="programme?.venues.length" layout="stack" />
        <HomeDontMiss :cards="dontMiss" layout="list" />
        <HomeVenues :venues="programme?.venues ?? []" :today-counts="venuesToday" :pending="pending" layout="list" />
        <HomeAbout :support-email="festival?.supportEmail" compact />
      </aside>
    </div>

    <!-- Phone / tablet: one column -->
    <template v-else>
      <HomeQuickLinks :from-price="fromPrice" :venue-count="programme?.venues.length" class="-mt-4" />
      <HomeNowNext
        :now="now"
        :today="today"
        :live-items="liveItems"
        :up-next="upNext"
        :up-next-title="upNextTitle"
        :up-next-day="upNextDay"
        :pending="pending"
      />
      <HomeFeatured :films="featured" :lookups="lookups" :pending="pending" />
      <HomeDontMiss :cards="dontMiss" layout="carousel" />
      <HomeSections :sections="sections" :pending="pending" />
      <HomeVenues :venues="programme?.venues ?? []" :today-counts="venuesToday" :pending="pending" layout="grid" />
      <HomeAbout :support-email="festival?.supportEmail" />
    </template>
  </div>
</template>
