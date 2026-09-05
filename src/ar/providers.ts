/**
 * AR capability detection and provider loading.
 *
 * Tier 1 (native): WebXR immersive-ar — Chrome Android 81+, Samsung Internet, Quest, visionOS Safari.
 * Tier 2 (iOS): a WebXR polyfill provider loaded on demand. Configure via env:
 *   VITE_IOS_XR_PROVIDER = 'variant-launch' | 'none'
 *   VITE_IOS_XR_SDK_URL  = full <script src> URL for the provider (includes the app key)
 * Tier 3: photo underlay tracing + camera-compass overlay (always available).
 */
export interface ARCapability {
  ios: boolean
  /** navigator.xr present and immersive-ar supported right now */
  nativeXR: boolean
  /** an iOS provider is configured (env) */
  providerConfigured: boolean
  providerName: 'variant-launch' | 'none'
}

const UA = () => (typeof navigator === 'undefined' ? '' : navigator.userAgent)

export function isIOS(): boolean {
  const ua = UA()
  const iPadOS = /Macintosh/.test(ua) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1
  return /iPhone|iPad|iPod/.test(ua) || iPadOS
}

export async function detectAR(): Promise<ARCapability> {
  const ios = isIOS()
  let nativeXR = false
  try { nativeXR = !!(typeof navigator !== 'undefined' && navigator.xr && (await navigator.xr.isSessionSupported('immersive-ar'))) } catch { nativeXR = false }
  const providerName = (import.meta.env.VITE_IOS_XR_PROVIDER as ARCapability['providerName'] | undefined) ?? 'none'
  const providerConfigured = providerName !== 'none' && !!import.meta.env.VITE_IOS_XR_SDK_URL
  return { ios, nativeXR, providerConfigured, providerName }
}

let providerPromise: Promise<boolean> | null = null

/**
 * Load the configured iOS provider SDK (once). Resolves true when `navigator.xr` becomes available
 * and reports immersive-ar support. The SDK may redirect the page into an App Clip flow; callers
 * should treat a pending navigation as normal.
 */
export function loadIOSProvider(): Promise<boolean> {
  if (providerPromise) return providerPromise
  providerPromise = (async () => {
    const url = import.meta.env.VITE_IOS_XR_SDK_URL as string | undefined
    if (!url) return false
    await new Promise<void>((resolve, reject) => {
      const s = document.createElement('script')
      s.src = url
      s.async = true
      s.onload = () => resolve()
      s.onerror = () => reject(new Error('iOS AR SDK 載入失敗'))
      document.head.appendChild(s)
    })
    // give the SDK a moment to install navigator.xr
    for (let i = 0; i < 20; i++) {
      if (navigator.xr) break
      await new Promise((r) => setTimeout(r, 100))
    }
    try { return !!(navigator.xr && (await navigator.xr.isSessionSupported('immersive-ar'))) } catch { return false }
  })()
  return providerPromise
}
