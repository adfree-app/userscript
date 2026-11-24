<script setup>
useHead({
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' }
  ],
  link: [
    { rel: 'icon', href: '/favicon.ico' }
  ],
  htmlAttrs: {
    lang: 'en'
  }
})

const title = 'Userscripts — AdFree'
const description = 'A small store of userscripts: install, update and remove them from AdFree or any userscript manager.'

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description,
  twitterCard: 'summary'
})

const repo = 'https://github.com/adfree-app/userscript'
</script>

<template>
  <UApp>
    <UHeader>
      <template #left>
        <NuxtLink
          to="/"
          class="focus-visible:outline-3 outline-primary/25 rounded-md p-1 -ms-1 flex items-center gap-2"
        >
          <UIcon
            name="i-lucide-square-code"
            class="size-6 text-primary"
          />
          <span class="font-semibold text-highlighted">userscripts</span>
        </NuxtLink>
      </template>

      <template #right>
        <UColorModeButton />

        <UButton
          :to="repo"
          target="_blank"
          icon="i-simple-icons-github"
          aria-label="GitHub"
          color="neutral"
          variant="ghost"
        />
      </template>
    </UHeader>

    <UMain>
      <NuxtPage />
    </UMain>

    <USeparator />

    <UFooter>
      <template #left>
        <p class="text-sm text-muted">
          Built with userscript-maker • © {{ new Date().getFullYear() }} AdFree
        </p>
      </template>

      <template #right>
        <UButton
          :to="repo"
          target="_blank"
          icon="i-simple-icons-github"
          aria-label="GitHub"
          color="neutral"
          variant="ghost"
        />
      </template>
    </UFooter>
  </UApp>
</template>
