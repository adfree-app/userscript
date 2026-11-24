<script setup lang="ts">
import type { CatalogScript } from '~/utils/catalog'
import type { AdFreeBridge } from '~/composables/useAdFree'
import { formatDate, formatSize, installUrl, permissionSummary } from '~/utils/catalog'
import { stateOf } from '~/composables/useAdFree'

const props = defineProps<{
  script: CatalogScript | null
  api: AdFreeBridge | null
  revision: number
  baseUrl: string
  generatedAt?: string
}>()

const open = defineModel<boolean>('open', { default: false })

const copied = ref(false)
const busy = ref(false)
const failure = ref('')

const url = computed(() => (props.script ? installUrl(props.script, props.baseUrl) : ''))
const state = computed(() => {
  void props.revision
  return props.script ? stateOf(props.api, url.value, props.script.version) : 'absent'
})

const rows = computed(() => {
  const script = props.script
  if (!script) return []
  return [
    { label: 'Slug', value: script.slug },
    { label: 'Version', value: script.version },
    { label: 'Author', value: script.author || '—' },
    { label: 'License', value: script.license || '—' },
    { label: 'Run at', value: script.runAt || 'document-idle' },
    { label: 'Size', value: `${formatSize(script.size)} (${formatSize(script.gzip)} gzip)` },
    { label: 'Built', value: formatDate(script.builtAt || props.generatedAt) },
    { label: 'Hash', value: script.hash ? script.hash.slice(0, 12) : '—' },
    { label: 'Namespace', value: script.namespace || '—' }
  ]
})

async function copy() {
  try {
    await navigator.clipboard.writeText(url.value)
    copied.value = true
    window.setTimeout(() => (copied.value = false), 1500)
  } catch {
    copied.value = false
  }
}

async function run() {
  const api = props.api
  if (!api || !props.script) return
  busy.value = true
  failure.value = ''
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
  <USlideover
    v-model:open="open"
    :title="script?.name"
    :description="script?.description"
    :ui="{ body: 'space-y-6' }"
  >
    <template #body>
      <template v-if="script">
        <div class="flex flex-wrap gap-2">
          <UButton
            v-if="state !== 'installed'"
            :label="state === 'outdated' ? `Update to ${script.version}` : 'Install'"
            :icon="state === 'outdated' ? 'i-lucide-refresh-cw' : 'i-lucide-download'"
            :loading="busy"
            @click="run"
          />
          <UButton
            v-else
            label="Installed"
            icon="i-lucide-check"
            color="success"
            variant="subtle"
            disabled
          />
          <UButton
            v-if="state !== 'absent'"
            label="Remove"
            icon="i-lucide-trash-2"
            color="error"
            variant="subtle"
            :loading="busy"
            @click="uninstall"
          />
          <UButton
            :label="copied ? 'Copied' : 'Copy .user.js URL'"
            :icon="copied ? 'i-lucide-check' : 'i-lucide-link'"
            color="neutral"
            variant="subtle"
            @click="copy"
          />
          <UButton
            v-if="script.source"
            label="Source"
            icon="i-simple-icons-github"
            color="neutral"
            variant="ghost"
            :to="script.source"
            target="_blank"
          />
        </div>

        <p
          v-if="failure"
          class="text-sm text-error"
        >
          {{ failure }}
        </p>

        <div>
          <h4 class="text-sm font-medium text-highlighted mb-2">
            Metadata
          </h4>
          <dl class="divide-y divide-default border-y border-default text-sm">
            <div
              v-for="row in rows"
              :key="row.label"
              class="grid grid-cols-3 gap-3 py-2"
            >
              <dt class="text-muted">
                {{ row.label }}
              </dt>
              <dd class="col-span-2 text-toned break-words">
                {{ row.value }}
              </dd>
            </div>
          </dl>
        </div>

        <div>
          <h4 class="text-sm font-medium text-highlighted mb-2">
            Runs on
          </h4>
          <ul class="space-y-1 text-sm text-toned font-mono">
            <li
              v-for="pattern in script.match"
              :key="pattern"
            >
              {{ pattern }}
            </li>
          </ul>
        </div>

        <div>
          <h4 class="text-sm font-medium text-highlighted mb-2">
            Permissions
          </h4>
          <div class="flex flex-wrap gap-1.5">
            <UBadge
              v-for="grant in permissionSummary(script)"
              :key="grant"
              color="neutral"
              variant="subtle"
              size="sm"
            >
              {{ grant }}
            </UBadge>
            <span
              v-if="permissionSummary(script).length === 0"
              class="text-sm text-muted"
            >none</span>
          </div>
          <template v-if="script.connect?.length">
            <h4 class="text-sm font-medium text-highlighted mt-4 mb-2">
              Reaches
            </h4>
            <div class="flex flex-wrap gap-1.5">
              <UBadge
                v-for="host in script.connect"
                :key="host"
                color="neutral"
                variant="outline"
                size="sm"
              >
                {{ host }}
              </UBadge>
            </div>
          </template>
        </div>
      </template>
    </template>
  </USlideover>
</template>
