
import {
  AlertCircle,
  BrainCircuit,
  LoaderCircle,
  Mic,
  Volume2,
  type LucideIcon,
} from 'lucide-react'

export type HologramState =
  | 'idle'
  | 'listening'
  | 'processing'
  | 'thinking'
  | 'speaking'
  | 'error'

interface AudioHologramProps {
  state: HologramState
}

interface HologramAppearance {
  label: string
  icon: LucideIcon
  border: string
  text: string
  background: string
  indicator: string
  ring: string
}

const appearances: Record<
  HologramState,
  HologramAppearance
> = {
  idle: {
    label: 'Bereit',
    icon: Mic,
    border: 'border-cyan-400/40',
    text: 'text-cyan-200',
    background: 'bg-slate-950',
    indicator: 'bg-slate-500',
    ring: 'border-cyan-300/15',
  },

  listening: {
    label: 'Aufnahme angefordert',
    icon: Mic,
    border: 'border-cyan-300',
    text: 'text-cyan-100',
    background: 'bg-cyan-950/70',
    indicator: 'bg-cyan-300',
    ring: 'border-cyan-300/50',
  },

  processing: {
    label: 'Sprache verarbeiten',
    icon: LoaderCircle,
    border: 'border-sky-300',
    text: 'text-sky-100',
    background: 'bg-sky-950/60',
    indicator: 'bg-sky-300',
    ring: 'border-sky-300/40',
  },

  thinking: {
    label: 'Anfrage bearbeiten',
    icon: BrainCircuit,
    border: 'border-violet-300',
    text: 'text-violet-100',
    background: 'bg-violet-950/50',
    indicator: 'bg-violet-300',
    ring: 'border-violet-300/40',
  },

  speaking: {
    label: 'Antwort wiedergeben',
    icon: Volume2,
    border: 'border-emerald-300',
    text: 'text-emerald-100',
    background: 'bg-emerald-950/50',
    indicator: 'bg-emerald-300',
    ring: 'border-emerald-300/45',
  },

  error: {
    label: 'Sprachfunktion unterbrochen',
    icon: AlertCircle,
    border: 'border-rose-300',
    text: 'text-rose-100',
    background: 'bg-rose-950/50',
    indicator: 'bg-rose-300',
    ring: 'border-rose-300/35',
  },
}

/**
 * HERMES Voice Hologram
 *
 * Pure presentation component.
 *
 * Displays only the voice state supplied by JarvisPage.
 * Does not acquire microphone access, create audio streams,
 * synthesize audio, or simulate audio levels.
 *
 * State-dependent ring animations are provided by
 * jarvis-cinematic.css and respect reduced-motion settings.
 */
export function AudioHologram({
  state,
}: AudioHologramProps) {
  const appearance = appearances[state]
  const Icon = appearance.icon

  const isActive =
    state !== 'idle' && state !== 'error'

  return (
    <div
      className={`
        jarvis-audio-core
        jarvis-audio-${state}
        relative
        isolate
        mx-auto
        flex
        h-52
        w-52
        shrink-0
        items-center
        justify-center
      `}
      role="img"
      aria-label={`Jarvis Sprachstatus: ${appearance.label}`}
    >
      {/* Static outer holographic boundary */}
      <div
        aria-hidden="true"
        className={`
          pointer-events-none
          absolute
          inset-0
          rounded-full
          border
          ${appearance.ring}
        `}
      />

      {/* Second circular ring */}
      <div
        aria-hidden="true"
        className={`
          pointer-events-none
          absolute
          inset-[13px]
          rounded-full
          border
          ${appearance.ring}
        `}
      />

      {/* Precision segments – decorative, not audio data */}
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox="0 0 208 208"
        fill="none"
      >
        <circle
          cx="104"
          cy="104"
          r="94"
          stroke="currentColor"
          strokeWidth="1"
          strokeDasharray="2 12"
          className="text-cyan-300/25"
        />

        <circle
          cx="104"
          cy="104"
          r="75"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="45 426"
          className="text-cyan-300/55"
          transform="rotate(-90 104 104)"
        />

        <circle
          cx="104"
          cy="104"
          r="75"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="45 426"
          className="text-cyan-300/35"
          transform="rotate(90 104 104)"
        />

        <circle
          cx="104"
          cy="104"
          r="62"
          stroke="currentColor"
          strokeWidth="1"
          className="text-cyan-300/15"
        />

        <path
          d="M104 2V12M104 196V206M2 104H12M196 104H206"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-cyan-300/45"
        />
      </svg>

      {/* Static dark central housing */}
      <div
        aria-hidden="true"
        className="
          pointer-events-none
          absolute
          inset-[43px]
          rounded-full
          border
          border-slate-600/35
          bg-slate-950/90
        "
      />

      {/* State-dependent illuminated core */}
      <div
        className={`
          relative
          z-10
          flex
          h-24
          w-24
          items-center
          justify-center
          rounded-full
          border-2
          ${appearance.border}
          ${appearance.background}
          ${appearance.text}
        `}
        aria-hidden="true"
      >
        <div
          className="
            pointer-events-none
            absolute
            inset-2
            rounded-full
            border
            border-white/10
          "
        />

        <Icon
          size={37}
          strokeWidth={1.5}
          className="relative z-10"
        />
      </div>

      {/* Small state indicator */}
      <div
        aria-hidden="true"
        className="
          pointer-events-none
          absolute
          bottom-[17px]
          left-1/2
          z-10
          flex
          -translate-x-1/2
          items-center
          gap-1.5
        "
      >
        <span
          className={`
            h-1.5
            w-1.5
            rounded-full
            ${appearance.indicator}
          `}
        />

        <span
          className={`
            h-[1px]
            ${isActive ? 'w-7' : 'w-4'}
            bg-current
            ${appearance.text}
            opacity-40
          `}
        />

        <span
          className={`
            h-1.5
            w-1.5
            rounded-full
            ${appearance.indicator}
          `}
        />
      </div>
    </div>
  )
}
