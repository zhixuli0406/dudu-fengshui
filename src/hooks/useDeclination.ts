import { useCallback, useState } from 'react'
import { useAppStore } from '../store/useAppStore'

export interface DeclinationState {
  busy: boolean
  error: string | null
  /** fetch location and compute declination via WMM2025 */
  locate: () => Promise<void>
}

/** Computes magnetic declination (east positive) with WMM via `geomagnetism` after obtaining GPS position. */
export function useDeclination(): DeclinationState {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const setSettings = useAppStore((s) => s.setSettings)

  const locate = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) { setError('此裝置不支援定位'); return }
    setBusy(true); setError(null)
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 }))
      const { latitude, longitude, accuracy } = pos.coords
      const decl = await computeDeclination(latitude, longitude, new Date())
      setSettings({ declination: Math.round(decl * 100) / 100, location: { lat: latitude, lon: longitude, accuracy, at: new Date().toISOString() } })
    } catch (e) {
      const msg = e instanceof GeolocationPositionError ? (e.code === 1 ? '定位權限被拒絕' : '無法取得定位') : (e as Error).message
      setError(msg)
    } finally { setBusy(false) }
  }, [setSettings])

  return { busy, error, locate }
}

export async function computeDeclination(lat: number, lon: number, date: Date): Promise<number> {
  const mod = await import('geomagnetism')
  const geomagnetism = (mod as unknown as { default?: GeomagnetismModule }).default ?? (mod as unknown as GeomagnetismModule)
  let model
  try { model = geomagnetism.model(date) } catch { model = geomagnetism.model(new Date('2029-06-01')) }
  return model.point([lat, lon]).decl
}

interface GeomagnetismModule { model: (date?: Date) => { point: (p: [number, number] | [number, number, number]) => { decl: number; incl: number } } }
