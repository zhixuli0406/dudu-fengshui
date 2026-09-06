import { useCallback, useEffect, useRef, useState } from 'react'
import { currentScreenAngle, headingFromEuler } from '../engine/orientation'
import { HeadingFilter } from '../engine/headingFilter'

export type CompassStatus = 'idle' | 'need-permission' | 'active' | 'unsupported' | 'denied'

export interface CompassReading {
  /** smoothed magnetic heading, degrees clockwise from magnetic north (0–360) */
  heading: number | null
  /** iOS webkitCompassAccuracy (degrees) or null */
  accuracy: number | null
  /** whether the value comes from an absolute (magnetometer-fused) source */
  absolute: boolean
  status: CompassStatus
  /** call inside a user gesture (iOS 13+) */
  requestPermission: () => Promise<void>
  samples: number
  /** flat = heading of device top; upright = heading of rear camera */
  mode: 'flat' | 'upright'
  /** circular std-dev of recent raw samples (deg); < 3 is steady */
  stability: number
}

interface IOSOrientationEvent extends DeviceOrientationEvent {
  webkitCompassHeading?: number
  webkitCompassAccuracy?: number
}

/**
 * Compass heading hook.
 * Sources: iOS `webkitCompassHeading` (absolute); Android `deviceorientationabsolute` (absolute, preferred);
 * plain `deviceorientation` alpha only as a last resort when no absolute source ever reports.
 * Never mixes absolute and relative streams (mixing them made the needle oscillate between two headings).
 * Smoothing: time-constant EMA on the unit circle + outlier gate + ~12 Hz UI updates.
 */
export function useCompass(): CompassReading {
  const [heading, setHeading] = useState<number | null>(null)
  const [accuracy, setAccuracy] = useState<number | null>(null)
  const [absolute, setAbsolute] = useState(false)
  const [status, setStatus] = useState<CompassStatus>('idle')
  const [samples, setSamples] = useState(0)
  const [mode, setMode] = useState<'flat' | 'upright'>('flat')
  const [stability, setStability] = useState(0)
  const filter = useRef(new HeadingFilter({ tauMs: 500, outlierDeg: 35, outlierConfirm: 4 }))
  const absoluteSeen = useRef(false)
  const modeRef = useRef<'flat' | 'upright'>('flat')
  const lastUi = useRef(0)
  const count = useRef(0)

  const onEvent = useCallback((e: DeviceOrientationEvent) => {
    const ev = e as IOSOrientationEvent
    const isAbsoluteEvent = e.type === 'deviceorientationabsolute' || ev.absolute === true || typeof ev.webkitCompassHeading === 'number'
    if (isAbsoluteEvent) absoluteSeen.current = true
    else if (absoluteSeen.current) return // ignore the relative stream once an absolute source exists
    let raw: number | null = null
    // mode with hysteresis (flat ↔ upright) from tilt only
    if (typeof ev.beta === 'number' && typeof ev.gamma === 'number') {
      const flatness = headingFromEuler(0, ev.beta, ev.gamma).flatness
      if (modeRef.current === 'flat' && flatness < 0.55) modeRef.current = 'upright'
      else if (modeRef.current === 'upright' && flatness > 0.8) modeRef.current = 'flat'
    }
    if (typeof ev.webkitCompassHeading === 'number' && !Number.isNaN(ev.webkitCompassHeading)) {
      raw = (ev.webkitCompassHeading + currentScreenAngle() + 360) % 360
      if (typeof ev.webkitCompassAccuracy === 'number') setAccuracy(ev.webkitCompassAccuracy < 0 ? null : ev.webkitCompassAccuracy)
    } else if (typeof ev.alpha === 'number') {
      const r = headingFromEuler(ev.alpha, ev.beta ?? 0, ev.gamma ?? 0, currentScreenAngle())
      raw = modeRef.current === 'flat' ? r.topHeading : r.cameraHeading
    }
    if (raw === null) return
    const now = performance.now()
    const smoothed = filter.current.push(raw, now)
    count.current += 1
    if (now - lastUi.current < 80) return // ~12 Hz UI
    lastUi.current = now
    setHeading(smoothed)
    setAbsolute(absoluteSeen.current)
    setMode(modeRef.current)
    setStability(filter.current.stability())
    setStatus('active')
    setSamples(count.current)
  }, [])

  const attach = useCallback(() => {
    if (typeof window === 'undefined') return
    if ('ondeviceorientationabsolute' in window) window.addEventListener('deviceorientationabsolute', onEvent as EventListener, true)
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
    filter.current.reset()
    attach()
    setStatus((s) => (s === 'active' ? s : 'need-permission'))
    setTimeout(() => setStatus((s) => (s === 'need-permission' ? 'unsupported' : s)), 2500)
  }, [attach])

  useEffect(() => {
    if (typeof window === 'undefined' || typeof DeviceOrientationEvent === 'undefined') { setStatus('unsupported'); return }
    const DOE = DeviceOrientationEvent as typeof DeviceOrientationEvent & { requestPermission?: () => Promise<string> }
    if (typeof DOE.requestPermission === 'function') { setStatus('need-permission'); return }
    attach()
    setStatus('need-permission')
    const t = setTimeout(() => setStatus((s) => (s === 'need-permission' ? 'unsupported' : s)), 3000)
    return () => {
      clearTimeout(t)
      window.removeEventListener('deviceorientationabsolute', onEvent as EventListener, true)
      window.removeEventListener('deviceorientation', onEvent as EventListener, true)
    }
  }, [attach, onEvent])

  return { heading, accuracy, absolute, status, requestPermission, samples, mode, stability }
}
