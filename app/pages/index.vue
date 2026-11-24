<script setup lang="ts">
import type { CatalogScript } from '~/utils/catalog'
import { formatDate, formatSize } from '~/utils/catalog'

const { scripts, generatedAt, error, pending, src } = useCatalog()
const { inApp, revision, api } = useAdFree()

const config = useRuntimeConfig()
const baseUrl = computed(() => new URL(config.app.baseURL, window.location.origin).href)

const selected = ref<CatalogScript | null>(null)
const open = ref(false)

function show(slug: string) {
  const script = scripts.value.find(entry => entry.slug === slug)
  if (!script) return
  selected.value = script
  open.value = true
  // shareable without a router deep link, so the static host needs no fallback
  navigateTo({ query: { ...useRoute().query, script: slug } }, { replace: true })
}

const route = useRoute()
onMounted(() => {
  const slug = typeof route.query.script === 'string' ? route.query.script : ''
  if (slug) {
    const script = scripts.value.find(entry => entry.slug === slug)
    if (script) {
      selected.value = script
      open.value = true
    }
  }
})

const totalSize = computed(() => scripts.value.reduce((sum, script) => sum + script.size, 0))
</script>

<template>
  <div>
    <UPageHero
      title="Userscripts"
      description="Drop-in scripts for Tampermonkey, Violentmonkey and AdFree. Install one here and keep it updated from here."
      :links="[
        {
          label: inApp ? 'AdFree connected' : 'Install AdFree',
          to: inApp ? undefined : 'https://adfree-app.github.io/',
          target: inApp ? undefined : '_blank',
          icon: inApp ? 'i-lucide-shield-check' : 'i-lucide-shield',
          color: inApp ? 'success' : 'primary',
          variant: inApp ? 'subtle' : 'solid',
          size: 'xl'
        },
        {
          label: 'Browse scripts',
          to: '#scripts',
          trailingIcon: 'i-lucide-arrow-down',
          color: 'neutral',
          variant: 'subtle',
          size: 'xl'
        }
      ]"
    />

    <UPageSection id="scripts">
      <div class="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <h2 class="text-xl font-semibold text-highlighted">
            {{ scripts.length }} script{{ scripts.length === 1 ? '' : 's' }}
          </h2>
          <p class="text-sm text-muted">
            {{ formatSize(totalSize) }} in total ·
            catalog built {{ formatDate(generatedAt) }}
          </p>
        </div>
        <UBadge
          v-if="inApp"
          color="success"
          variant="subtle"
          icon="i-lucide-shield-check"
          size="sm"
        >
          Running inside AdFree — install and update from here
        </UBadge>
        <UBadge
          v-else
          color="neutral"
          variant="subtle"
          icon="i-lucide-info"
          size="sm"
        >
          Open this page in AdFree to install with one tap
        </UBadge>
      </div>

      <div
        v-if="pending"
        class="grid gap-4 sm:grid-cols-2"
      >
        <USkeleton
          v-for="n in 2"
          :key="n"
          class="h-52"
        />
      </div>

      <UAlert
        v-else-if="error"
        color="error"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        title="Could not read the catalog"
        :description="`${src} — build the site with \`bun run build:pages\` first.`"
      />

      <div
        v-else
        class="grid gap-4 sm:grid-cols-2"
      >
        <ScriptCard
          v-for="script in scripts"
          :key="script.slug"
          :script="script"
          :api="api"
          :revision="revision"
          :base-url="baseUrl"
          @open="show"
        />
      </div>
    </UPageSection>

    <UPageSection>
      <div class="grid gap-4 sm:grid-cols-2">
        <UCard>
          <template #header>
            <h3 class="font-semibold text-highlighted flex items-center gap-2">
              <UIcon
                name="i-lucide-smartphone"
                class="size-4"
              />
              In AdFree
            </h3>
          </template>
          <ol class="text-sm text-muted space-y-2 list-decimal list-inside">
            <li>Open this page inside AdFree's browser.</li>
            <li>The app adds its install control to every card here.</li>
            <li>
              Install, update or remove a script without leaving the page.
            </li>
          </ol>
        </UCard>

        <UCard>
          <template #header>
            <h3 class="font-semibold text-highlighted flex items-center gap-2">
              <UIcon
                name="i-lucide-puzzle"
                class="size-4"
              />
              Any other userscript manager
            </h3>
          </template>
          <p class="text-sm text-muted">
            A card's install button opens the raw <code class="text-toned">.user.js</code>.
            Tampermonkey, Violentmonkey and Greasemonkey take it from there, and
            every file carries <code class="text-toned">@updateURL</code>, so the
            manager keeps it current after the first install.
          </p>
        </UCard>
      </div>
    </UPageSection>

    <ScriptDetails
      v-model:open="open"
      :script="selected"
      :api="api"
      :revision="revision"
      :base-url="baseUrl"
      :generated-at="generatedAt"
    />
  </div>
</template>
