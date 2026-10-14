<script setup lang="ts">
import type { StaffRole } from '@afriff/api/door'

/** Adding someone to the team. They get an email with a link to choose their own password. */
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ done: [] }>()

const form = reactive({ name: '', email: '', role: 'door' as StaffRole })
const { run, pending, errorFor, formError } = useOpsAction('inviteStaff')
const roles = [
  { value: 'door' as const, label: 'Door: scans tickets in AFRIFF Door' },
  { value: 'ops' as const, label: 'Ops: runs this console' },
  { value: 'admin' as const, label: 'Admin: Ops, and manages staff' },
]

watch(open, (value) => {
  if (value) Object.assign(form, { name: '', email: '', role: 'door' })
})

async function submit() {
  if (await run({ name: form.name, email: form.email, role: form.role }, `Invitation on its way to ${form.email.trim()}.`)) {
    open.value = false
    emit('done')
  }
}
</script>

<template>
  <UiSheet v-model:open="open" title="Add to the team">
    <form class="space-y-4" novalidate @submit.prevent="submit">
      <UiInput v-model="form.name" label="Name" placeholder="Landmark door 1" :error="errorFor('name')" :disabled="pending" />
      <UiInput v-model="form.email" label="Email" type="email" inputmode="email" :error="errorFor('email')" :disabled="pending" />
      <UiSelect v-model="form.role" label="Role" :options="roles" :disabled="pending" />
      <p class="text-meta text-pretty text-muted">An existing AFRIFF account keeps its tickets and gains the role. A new one is made for them.</p>
      <p v-if="formError(['name', 'email'])" role="alert" class="text-meta text-danger">{{ formError(['name', 'email']) }}</p>
      <UiButton type="submit" block :loading="pending">Send invitation</UiButton>
    </form>
  </UiSheet>
</template>
