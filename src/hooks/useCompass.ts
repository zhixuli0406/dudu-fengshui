import { useCallback, useEffect, useRef, useState } from 'react'

export type CompassStatus = 'idle' | 'need-permission' | 'active' | 'unsupported' | 'denied'

export interface CompassReading {
  /** magnetic heading, degrees clockwise from magnetic north (0–360) */
  heading: number | null
  /** iOS webkitCompassAccuracy (degrees) or null */
  accuracy: number | null
  /** whether the value is from an absolute (magnetometer-fused) source */
  absolute: boolean
  status: CompassStatus
  /** call inside a user gesture (iOS 13+) */
  requestPermission: () => Promise<void>
  /** sample count since activation */
  samples: number
}

interface IOSOrientationEvent extends DeviceOrientationEvent {
  webkitCompassHeading?: number
  webkitCompassAccuracy?: number
}

function screenAngle(): number {
  const so = (typeof screen !== 'undefined' && screen.orientation && typeof screen.orientation.angle === 'number') ? screen.orientation.angle : (typeof window !== 'undefined' && typeof (window as unknown as { orientation?: number }).orientation === 'number' ? (window as unknown as { orientation: number }).orientation : 0)
  return so
}

/**
 * Compass heading hook. Uses `webkitCompassHeading` on iOS (already true magnetic heading, 0 = north),
 * `deviceorientationabsolute` on Android/Chrome (alpha is counter-clockwise from north → heading = 360 − alpha),
 * and corrects for screen rotation. Applies light exponential smoothing on the unit circle.
 */
export function useCompass(): CompassReading {
  const [heading, setHeading] = useState<number | null>(null)
  const [accuracy, setAccuracy] = useState<number | null>(null)
  const [absolute, setAbsolute] = useState(false)
  const [status, setStatus] = useState<CompassStatus>('idle')
  const [samples, setSamples] = useState(0)
  const smooth = useRef<{ x: number; y: number } | null>(null)

  const onEvent = useCallback((e: DeviceOrientationEvent) => {
    const ev = e as IOSOrientationEvent
    let h: number | null = null
    let abs = false
    if (typeof ev.webkitCompassHeading === 'number' && !Number.isNaN(ev.webkitCompassHeading)) {
      h = ev.webkitCompassHeading
      abs = true
      if (typeof ev.webkitCompassAccuracy === 'number') setAccuracy(ev.webkitCompassAccuracy < 0 ? null : ev.webkitCompassAccuracy)
      // iOS: webkitCompassHeading is relative to the device top regardless of screen orientation? It follows device; correct for screen rotation.
      h = (h + screenAngle() + 360) % 360
    } else if (typeof ev.alpha === 'number') {
      abs = ev.absolute === true || e.type === 'deviceorientationabsolute'
      h = (360 - ev.alpha + screenAngle() + 360) % 360
    }
    if (h === null) return
    // smoothing on unit circle
    const r = (h * Math.PI) / 180
    const v = { x: Math.cos(r), y: Math.sin(r) }
    const a = 0.25
    smooth.current = smooth.current ? { x: smooth.current.x * (1 - a) + v.x * a, y: smooth.current.y * (1 - a) + v.y * a } : v
    const sh = ((Math.atan2(smooth.current.y, smooth.current.x) * 180) / Math.PI + 360) % 360
    setHeading(sh)
    setAbsolute(abs)
    setStatus('active')
    setSamples((n) => n + 1)
  }, [])

  const attach = useCallback(() => {
    if (typeof window === 'undefined') return
    if ('ondeviceorientationabsolute' in window) {
      window.addEventListener('deviceorientationabsolute', onEvent as EventListener, true)
    }
    window.addEventListener('deviceorientation', onEvent as EventListener, true)
  }, [onEvent])

  const requestPermission = useCallback(async () => {
    const DOE = (typeof DeviceOrientationEvent !== 'undefined' ? DeviceOrientationEvent : undefined) as (typeof DeviceOrientationEvent & { requestPermission?: () => Promise<'granted' | 'denied'> }) | undefined
    if (!DOE) { setStatus('unsupported'); return }
    if (typeof DOE.requestPermission === 'function') {
      try {
        const res = await DOE.requestPermission()
        if (res !== 'granted') { setStatus('denied'); return }
      } catch { setStatus('denied'); return }
    }
    attach()
    setStatus((s) => (s === 'active' ? s : 'need-permission'))
    // if no events arrive within 2s, mark unsupported (desktop)
    setTimeout(() => setStatus((s) => (s === 'need-permission' ? 'unsupported' : s)), 2500)
  }, [attach])

  useEffect(() => {
    if (typeof window === 'undefined' || typeof DeviceOrientationEvent === 'undefined') { setStatus('unsupported'); return }
    const DOE = DeviceOrientationEvent as typeof DeviceOrientationEvent & { requestPermission?: () => Promise<string> }
    if (typeof DOE.requestPermission === 'function') {
      setStatus('need-permission')
      return
    }
    attach()
    setStatus('need-permission')
    const t = setTimeout(() => setStatus((s) => (s === 'need-permission' ? 'unsupported' : s)), 3000)
    return () => {
      clearTimeout(t)
      window.removeEventListener('deviceorientationabsolute', onEvent as EventListener, true)
      window.removeEventListener('deviceorientation', onEvent as EventListener, true)
    }
  }, [attach, onEvent])

  return { heading, accuracy, absolute, status, requestPermission, samples }
}
