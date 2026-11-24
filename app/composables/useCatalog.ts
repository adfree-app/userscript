import type { Catalog, CatalogScript } from '~/utils/catalog'
import { CATALOG_PATH, sortScripts } from '~/utils/catalog'

/**
 * The catalog written by `usm catalog`. It is a static file next to the built
 * userscripts, so the page reads it at runtime and a release shows up without
 * rebuilding the app.
 */
export function useCatalog() {
  const config = useRuntimeConfig()
  const src = `${config.app.baseURL}${CATALOG_PATH}`

  const { data, error, pending, refresh } = useFetch<Catalog>(src, {
    key: 'userscript-catalog',
    // a stale cache would offer an update that is already installed
    cache: 'no-cache'
  })

  const scripts = computed<CatalogScript[]>(() => sortScripts(data.value?.scripts ?? []))
  const generatedAt = computed(() => data.value?.generatedAt)

  function bySlug(slug: string): CatalogScript | undefined {
    return scripts.value.find(script => script.slug === slug)
  }

  return { scripts, generatedAt, error, pending, refresh, bySlug, src }
}
