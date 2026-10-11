import { useId } from 'react'

export function HologramBrain({ active }: { active: boolean }) {
  const id = useId()
  return <svg viewBox="0 0 600 420" className="command-hologram" role="img" aria-label="Holografischer Hermes-Kern, dekorativ" data-active={active}>
    <defs><radialGradient id={id}><stop stopColor="var(--command-cyan)" stopOpacity=".2" /><stop offset=".65" stopColor="var(--command-blue)" stopOpacity=".08" /><stop offset="1" stopColor="var(--command-blue)" stopOpacity="0" /></radialGradient></defs>
    <circle cx="300" cy="195" r="190" fill={`url(#${id})`} />
    <g fill="none" stroke="var(--command-blue)" strokeOpacity=".3"><path d="M75 110 205 165M525 110 395 165M75 300 205 230M525 300 395 230" /><ellipse cx="300" cy="205" rx="245" ry="80" /><ellipse cx="300" cy="205" rx="205" ry="116" transform="rotate(-25 300 205)" /></g>
    <g className="command-orbit" fill="none" stroke="var(--command-cyan)" transform="translate(300 195)">
      <circle r="133" strokeOpacity=".15" /><circle r="127" strokeWidth="2" strokeDasharray="100 22 2 22" strokeOpacity=".65" /><circle r="112" strokeDasharray="1 8" strokeWidth="3" strokeOpacity=".55" /><circle r="101" strokeOpacity=".4" />
    </g>
    <g fill="none" stroke="var(--command-cyan-soft)" strokeWidth="1.8" strokeLinejoin="round">
      <path d="M299 120c-17-15-44-1-43 16-20-2-35 18-28 35-21 9-17 39-3 45-8 23 12 38 28 35 2 20 32 22 46 4Zm3 0c17-15 44-1 43 16 20-2 35 18 28 35 21 9 17 39 3 45 8 23-12 38-28 35-2 20-32 22-46 4Z" />
      <path d="m256 136 21 17-12 26 33 11-29 21 9 26-25 14m92-115-21 17 12 26-33 11 29 21-9 26 25 14M228 171l37 8-10 22-30 15m148-45-37 8 10 22 30 15m-98-63 21-14m25 14-21-14m-24 98 20 18m24-18-20 18" strokeOpacity=".65" />
    </g>
    <g fill="var(--command-cyan)">{[[256,136],[265,179],[277,153],[269,211],[278,237],[345,136],[336,179],[324,153],[332,211],[323,237]].map(([cx,cy]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="3" />)}</g>
  </svg>
}
