<script setup lang="ts">
import type { CatalogScript } from '~/utils/catalog'
import type { AdFreeBridge } from '~/composables/useAdFree'
import { formatSize, installUrl, matchSummary, permissionSummary } from '~/utils/catalog'
import { stateOf } from '~/composables/useAdFree'

const props = defineProps<{
  script: CatalogScript
  api: AdFreeBridge | null
  revision: number
  baseUrl: string
}>()

const emit = defineEmits<{ open: [slug: string] }>()

const busy = ref(false)
const failure = ref('')

const url = computed(() => installUrl(props.script, props.baseUrl))
const state = computed(() => {
  // `revision` is the app's list changing under us (an install elsewhere)
  void props.revision
  return stateOf(props.api, url.value, props.script.version)
})

const label = computed(() => {
  if (state.value === 'installed') return 'Installed'
  if (state.value === 'outdated') return `Update to ${props.script.version}`
  return 'Install'
})

const labelIcon = computed(() => {
  if (state.value === 'installed') return 'i-lucide-check'
  if (state.value === 'outdated') return 'i-lucide-refresh-cw'
  return 'i-lucide-download'
})

async function run() {
  const api = props.api
  failure.value = ''
  if (!api) {
    window.open(url.value, '_blank', 'noopener')
    return
  }
  busy.value = true
  try {
    await (state.value === 'outdated' ? api.update(url.value) : api.install(url.value))
  } catch (error) {
    failure.value = (error as Error).message || 'failed'
  } finally {
    busy.value = false
  }
}

async function uninstall() {
  const api = props.api
  if (!api) return
  busy.value = true
  failure.value = ''
  try {
    await api.remove(url.value)
  } catch (error) {
    failure.value = (error as Error).message || 'failed'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <UCard class="flex flex-col h-full">
    <div class="flex items-start gap-3">
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <h3 class="font-semibold text-highlighted">
            {{ script.name }}
          </h3>
          <UBadge
            color="neutral"
            variant="subtle"
            size="sm"
          >
            v{{ script.version }}
          </UBadge>
          <UBadge
            v-if="state === 'installed'"
            color="success"
            variant="subtle"
            size="sm"
            icon="i-lucide-check"
          >
            Installed
          </UBadge>
          <UBadge
            v-else-if="state === 'outdated'"
            color="warning"
            variant="subtle"
            size="sm"
            icon="i-lucide-refresh-cw"
          >
            Update available
          </UBadge>
        </div>
        <p class="text-sm text-muted mt-1">
          {{ script.description }}
        </p>
      </div>
    </div>

    <dl class="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted mt-4">
      <dt class="sr-only">
        Runs on
      </dt>
      <dd class="col-span-2 flex items-center gap-1.5">
        <UIcon
          name="i-lucide-globe"
          class="size-3.5 shrink-0"
        />
        <span class="truncate">{{ matchSummary(script) }}</span>
      </dd>
      <dt class="sr-only">
        Size
      </dt>
      <dd class="flex items-center gap-1.5">
        <UIcon
          name="i-lucide-file-code"
          class="size-3.5 shrink-0"
        />
        {{ formatSize(script.size) }} · {{ formatSize(script.gzip) }} gzip
      </dd>
      <dd class="flex items-center gap-1.5">
        <UIcon
          name="i-lucide-shield"
          class="size-3.5 shrink-0"
        />
        {{ permissionSummary(script).length }} permission(s)
      </dd>
    </dl>

    <p
      v-if="failure"
      class="text-xs text-error mt-3"
    >
      {{ failure }}
    </p>

    <div class="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-default">
      <UButton
        :icon="labelIcon"
        :label="label"
        :loading="busy"
        :disabled="state === 'installed'"
        color="primary"
        @click="run"
      />
      <UButton
        v-if="state !== 'absent'"
        icon="i-lucide-trash-2"
        label="Remove"
        color="error"
        variant="subtle"
        :loading="busy"
        @click="uninstall"
      />
      <UButton
        icon="i-lucide-info"
        label="Details"
        color="neutral"
        variant="ghost"
        class="ms-auto"
        @click="emit('open', script.slug)"
      />
    </div>
  </UCard>
</template>
