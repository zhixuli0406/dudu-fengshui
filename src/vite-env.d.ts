/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_IOS_XR_PROVIDER?: 'variant-launch' | 'none'
  readonly VITE_IOS_XR_SDK_URL?: string
}
interface ImportMeta { readonly env: ImportMetaEnv }
