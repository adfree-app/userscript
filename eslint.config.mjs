// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt({
  // userscript-maker is a standalone package: it has its own oxlint + oxfmt setup.
  ignores: ['packages/**', 'dist/**', '.output/**', 'public/userscripts/**']
})
