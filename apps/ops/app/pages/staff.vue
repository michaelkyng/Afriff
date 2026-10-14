<script setup lang="ts">
import { UserPlusIcon } from 'lucide-vue-next'
import type { StaffRole } from '@afriff/api/door'
import type { StaffAccount } from '@afriff/api/ops'

useHead({ title: 'Staff' })

const ops = useOps()
const { staff: me, isAdmin } = useStaff()
const { data: staff, refresh } = useAsyncData('ops:staff', () => ops.act('listStaff', {}))
const inviting = ref(false)
const change = useOpsAction('setStaffRole')

const ROLE_LABEL: Record<StaffRole, string> = { door: 'Door', ops: 'Ops', admin: 'Admin' }
const roleOptions = [
  { value: 'door' as const, label: 'Door' },
  { value: 'ops' as const, label: 'Ops' },
  { value: 'admin' as const, label: 'Admin' },
]

async function setRole(person: StaffAccount, role: StaffRole | null) {
  const done = await change.run({ uid: person.id, role }, role ? `${person.name} is now ${ROLE_LABEL[role]}.` : `${person.name} no longer has staff access.`)
  if (done) refresh()
}
</script>

<template>
  <div>
    <OpsHeader title="Staff" description="Who can scan tickets and who can use this console.">
      <UiButton v-if="isAdmin" @click="inviting = true">
        <UserPlusIcon aria-hidden="true" />
        Add someone
      </UiButton>
    </OpsHeader>

    <p v-if="!isAdmin" class="mb-4 rounded-tile border border-line bg-raised px-3.5 py-2.5 text-meta text-muted">Only an admin can add people or change roles.</p>
    <p v-if="change.error.value" role="alert" class="mb-3 text-meta text-danger">{{ change.error.value }}</p>

    <UiSkeleton v-if="!staff" class="h-64 rounded-card" />
    <UiCard v-else :padded="false" class="overflow-x-auto">
      <table class="ops-table">
        <thead><tr><th scope="col">Name</th><th scope="col">Email</th><th scope="col">Role</th><th scope="col"><span class="sr-only">Access</span></th></tr></thead>
        <tbody>
          <tr v-for="person in staff" :key="person.id" :class="!person.active && 'opacity-60'">
            <td class="font-medium">{{ person.name }}<span v-if="person.id === me?.id" class="text-muted"> (you)</span></td>
            <td class="text-muted">{{ person.email }}</td>
            <td class="min-w-44">
              <UiSelect
                v-if="isAdmin && person.active && person.id !== me?.id"
                :model-value="person.role"
                :label="`Role for ${person.name}`"
                :options="roleOptions"
                class="[&_label]:sr-only [&_select]:h-9"
                :disabled="change.pending.value"
                @update:model-value="(role) => role && role !== person.role && setRole(person, role)"
              />
              <span v-else>{{ person.active ? ROLE_LABEL[person.role] : 'No access' }}</span>
            </td>
            <td class="text-right">
              <UiButton v-if="isAdmin && person.id !== me?.id" size="sm" variant="ghost" :disabled="change.pending.value" @click="setRole(person, person.active ? null : 'door')">
                {{ person.active ? 'Remove access' : 'Restore as Door' }}
              </UiButton>
            </td>
          </tr>
        </tbody>
      </table>
    </UiCard>
    <p class="mt-3 text-label text-pretty text-muted">
      Taking access away signs them out on their next connection; a device already signed in may keep scanning for up to an hour.
    </p>

    <InviteStaffSheet v-model:open="inviting" @done="refresh()" />
  </div>
</template>
