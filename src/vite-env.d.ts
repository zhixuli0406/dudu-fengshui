/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_VARIANT_LAUNCH_KEY?: string
}
interface ImportMeta { readonly env: ImportMetaEnv }
