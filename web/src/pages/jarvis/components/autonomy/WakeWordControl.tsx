import { Ear, ShieldCheck } from 'lucide-react'
import { Button } from '@nous-research/ui/ui/components/button'

export function WakeWordControl({ armed, onChange }: { armed: boolean; onChange: (armed: boolean) => void }) {
  const status = armed ? 'READY' : 'OFF'
  return <section className="jarvis-glass p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="flex items-center gap-2 text-xs uppercase tracking-[.2em] text-cyan-300/80"><Ear className="h-4 w-4" /> Wake Word</p><h2 className="mt-1 text-xl text-slate-100">Jarvis <span className="ml-2 text-sm text-cyan-200">{status}</span></h2><p className="mt-2 max-w-2xl text-sm text-slate-500">Lokale Vorbereitung: Audio Input → Wake-Word-Detection → Command Capture → Hermes Router. Kein Cloud-Stream und keine Aufnahme, bevor die Person die Erkennung aktiviert.</p></div><Button outlined={armed} onClick={() => onChange(!armed)}>{armed ? 'Erkennung deaktivieren' : 'Erkennung aktivieren'}</Button></div><div className="mt-4 flex items-center gap-2 border-t border-white/10 pt-3 text-xs text-slate-400"><ShieldCheck className="h-4 w-4 text-emerald-300" />{armed ? 'READY: Lokale Wake-Word-Sitzung ist vorbereitet. ACTIVE wird erst während einer expliziten Sprachaufnahme gemeldet.' : 'OFF: keine Mikrofonressource angefordert.'}</div></section>
}
