/**
 * AR capability detection and iOS provider (Variant Launch) integration.
 *
 * Tier 1 (native): WebXR immersive-ar — Chrome Android 81+, Samsung Internet, Quest, visionOS Safari.
 * Tier 2 (iOS): Variant Launch — App Clip viewer that exposes WebXR (hit-test, transient hit-test, anchors,
 *   DOM overlay; no plane-detection / depth). Docs: https://launch.variant3d.com/docs/using-the-sdk
 *   Configure `VITE_VARIANT_LAUNCH_KEY`; the exact host (e.g. zhixuli0406.github.io) must be authorised in the
 *   Launch admin site. Free Developer plan: 3,000 views/month (launch.variant3d.com, 2026-09-05).
 * Tier 3: photo underlay tracing + camera-compass overlay (always available).
 */
export type WebXRStatus = 'supported' | 'launch-required' | 'unsupported'

export interface ARCapability {
  ios: boolean
  /** navigator.xr present and immersive-ar supported right now */
  nativeXR: boolean
  /** Variant Launch key configured (env) */
  providerConfigured: boolean
  providerName: 'variant-launch' | 'none'
  /** status reported by the Variant Launch SDK once initialised */
  launchStatus?: WebXRStatus
  /** URL that opens the current page inside the Launch viewer (App Clip) */
  launchUrl?: string
}

interface VLaunchInitDetail { launchRequired: boolean; webXRStatus: WebXRStatus; launchUrl?: string; directAppClipUrl?: string }

const UA = () => (typeof navigator === 'undefined' ? '' : navigator.userAgent)

export function isIOS(): boolean {
  const ua = UA()
  const iPadOS = /Macintosh/.test(ua) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1
  return /iPhone|iPad|iPod/.test(ua) || iPadOS
}

export const VARIANT_LAUNCH_KEY: string | undefined = import.meta.env.VITE_VARIANT_LAUNCH_KEY || undefined

let initDetail: VLaunchInitDetail | null = null
let sdkPromise: Promise<VLaunchInitDetail | null> | null = null

/**
 * Inject the Variant Launch SDK (idempotent). Call once at app start on iOS when a key is configured so the
 * 'vlaunch-initialized' event is captured early; safe to call again later (returns the cached detail).
 */
export function initVariantLaunch(): Promise<VLaunchInitDetail | null> {
  if (sdkPromise) return sdkPromise
  if (!VARIANT_LAUNCH_KEY || typeof document === 'undefined') return Promise.resolve(null)
  sdkPromise = new Promise<VLaunchInitDetail | null>((resolve) => {
    const done = (d: VLaunchInitDetail | null) => { initDetail = d; resolve(d) }
    window.addEventListener('vlaunch-initialized', ((e: CustomEvent<VLaunchInitDetail>) => done(e.detail)) as EventListener, { once: true })
    const s = document.createElement('script')
    // no `redirect=true`: the scan page decides when to hand off to the App Clip
    s.src = `https://launchar.app/sdk/v1?key=${encodeURIComponent(VARIANT_LAUNCH_KEY!)}`
    s.async = true
    s.onerror = () => done(null)
    document.head.appendChild(s)
    setTimeout(() => { if (!initDetail) done(null) }, 8000)
  })
  return sdkPromise
}

export async function detectAR(): Promise<ARCapability> {
  const ios = isIOS()
  let nativeXR = false
  try { nativeXR = !!(typeof navigator !== 'undefined' && navigator.xr && (await navigator.xr.isSessionSupported('immersive-ar'))) } catch { nativeXR = false }
  const providerConfigured = !!VARIANT_LAUNCH_KEY
  const cap: ARCapability = { ios, nativeXR, providerConfigured, providerName: providerConfigured ? 'variant-launch' : 'none' }
  if (ios && providerConfigured && !nativeXR) {
    const d = await initVariantLaunch()
    if (d) {
      cap.launchStatus = d.webXRStatus
      cap.launchUrl = d.launchUrl
      if (d.webXRStatus === 'supported') {
        try { cap.nativeXR = !!(navigator.xr && (await navigator.xr.isSessionSupported('immersive-ar'))) } catch { /* keep false */ }
      }
    }
  }
  return cap
}

/** Hand the current page to the Launch viewer (App Clip). Must be called from a user gesture. */
export function openInLaunchViewer(cap: ARCapability): boolean {
  const url = cap.launchUrl ?? (typeof window !== 'undefined' && (window as unknown as { VLaunch?: { getLaunchUrl?: (u: string) => string } }).VLaunch?.getLaunchUrl?.(window.location.href))
  if (!url) return false
  window.location.href = url
  return true
}
