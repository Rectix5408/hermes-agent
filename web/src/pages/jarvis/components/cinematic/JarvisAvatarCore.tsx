import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
} from 'react'

import type {
  VoiceApprovalDisplay,
  VoiceToolActivity,
} from '../../voice-runtime/hermes-conversation'
import {
  avatarAppearances,
  avatarStateFor,
} from './jarvis-avatar-core-state'
import type { ProductionVoiceState } from '../../voice-runtime/production-state'

export interface JarvisAvatarCoreProps {
  voiceState: ProductionVoiceState
  approval?: VoiceApprovalDisplay | null
  tools?: VoiceToolActivity[]
  /** A real microphone analyser value in the [0, 1] range; undefined means no signal. */
  audioLevel?: number
}

function clampAudioLevel(value?: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value ?? 0))
}

/**
 * Decorative, state-driven presence for the existing voice session.
 *
 * It never acquires media, opens a websocket, or creates an AudioContext. The
 * optional level is produced by the one analyser already used by the console.
 */
export function JarvisAvatarCore({
  voiceState,
  approval,
  tools,
  audioLevel,
}: JarvisAvatarCoreProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const instanceId = useId().replaceAll(':', '')
  const coreGlowId = `jarvis-avatar-core-glow-${instanceId}`
  const prismId = `jarvis-avatar-prism-${instanceId}`
  const [visible, setVisible] = useState(true)
  const state = avatarStateFor(voiceState, approval, tools)
  const appearance = avatarAppearances[state]
  const level = clampAudioLevel(audioLevel)
  const style = {
    '--jarvis-audio-level': level.toFixed(3),
    '--jarvis-audio-glow': (.1 + level * .24).toFixed(3),
    '--jarvis-audio-scale': (1 + level * .26).toFixed(3),
    '--jarvis-audio-listening-scale': (1.035 + level * .3).toFixed(3),
  } as CSSProperties

  useEffect(() => {
    const root = rootRef.current
    if (!root || typeof IntersectionObserver === 'undefined') return

    const observer = new IntersectionObserver(entries => {
      setVisible(entries.some(entry => entry.isIntersecting))
    }, { threshold: 0.08 })

    observer.observe(root)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={rootRef}
      className="jarvis-avatar-core"
      data-state={state}
      data-visible={visible ? 'true' : 'false'}
      style={style}
      role="img"
      aria-label={`Jarvis AI-Präsenz: ${appearance.label}. ${appearance.description}`}
    >
      <span className="sr-only" role="status" aria-live="polite">
        Jarvis: {appearance.label}
      </span>

      <svg
        aria-hidden="true"
        className="jarvis-avatar-svg"
        viewBox="0 0 360 360"
        fill="none"
      >
        <defs>
          <radialGradient id={coreGlowId} cx="50%" cy="45%" r="55%">
            <stop stopColor="#d9fbff" stopOpacity=".95" />
            <stop offset=".25" stopColor="#36cfff" stopOpacity=".78" />
            <stop offset=".7" stopColor="#0974bd" stopOpacity=".25" />
            <stop offset="1" stopColor="#06111f" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={prismId} x1="132" y1="110" x2="226" y2="250">
            <stop stopColor="#dcfdff" />
            <stop offset=".48" stopColor="#26c9ff" />
            <stop offset="1" stopColor="#8e5cff" />
          </linearGradient>
        </defs>

        <circle className="jarvis-avatar-halo" cx="180" cy="180" r="157" />
        <circle className="jarvis-avatar-grid-ring" cx="180" cy="180" r="140" />
        <circle className="jarvis-avatar-orbit jarvis-avatar-orbit-one" cx="180" cy="180" r="117" />
        <circle className="jarvis-avatar-orbit jarvis-avatar-orbit-two" cx="180" cy="180" r="93" />
        <path className="jarvis-avatar-crosshair" d="M180 17v26M180 317v26M17 180h26M317 180h26" />
        <path className="jarvis-avatar-data-line" d="M59 180h74M227 180h74" />
        <circle className="jarvis-avatar-energy" cx="180" cy="180" r="76" fill={`url(#${coreGlowId})`} />
        <circle className="jarvis-avatar-housing" cx="180" cy="180" r="53" />

        <g className="jarvis-avatar-prism">
          <path d="M180 132 218 154 180 226 142 154 180 132Z" fill={`url(#${prismId})`} fillOpacity=".22" />
          <path d="m180 137 31 18-31 61-31-61 31-18Z" stroke={`url(#${prismId})`} strokeWidth="3" />
          <path d="m180 154 14 8-14 34-14-34 14-8Z" fill="#e8feff" fillOpacity=".86" />
          <path d="M180 196v17M163 163l-14 8M197 163l14 8" stroke="#d7fbff" strokeWidth="2" strokeLinecap="round" />
        </g>

        <g className="jarvis-avatar-particles">
          <circle cx="84" cy="135" r="2" /><circle cx="106" cy="82" r="2.5" />
          <circle cx="272" cy="110" r="2" /><circle cx="294" cy="221" r="2.5" />
          <circle cx="95" cy="261" r="2.5" /><circle cx="232" cy="280" r="1.8" />
        </g>
      </svg>

      <div className="jarvis-avatar-caption" aria-hidden="true">
        <span>{appearance.label}</span>
        <i />
        <span>HERMES</span>
      </div>
    </div>
  )
}
