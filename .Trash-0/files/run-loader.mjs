// `--import` entry point: register the alias / css-stub loader hooks so that
// `node --experimental-strip-types --test` can load the TypeScript source.
import { register } from 'node:module'

register(new URL('./hooks.mjs', import.meta.url).href, import.meta.url)
