import { BrainCircuit } from 'lucide-react'
import type { MemoryStatus } from '@/lib/api'
import { memoryTelemetry } from '../../cinematic/live-runtime'

export function MemoryIntelligence({ memory }: { memory: MemoryStatus | null }) { const telemetry = memoryTelemetry(memory); return <section className="jarvis-glass p-5"><p className="flex items-center gap-2 text-xs uppercase tracking-[.2em] text-cyan-300/80"><BrainCircuit className="h-4 w-4" /> Memory Intelligence</p><div className="mt-4 grid gap-3 sm:grid-cols-3"><Metric label="Aktive Speicheranbieter" value={String(telemetry.active)} /><Metric label="Gespeichert" value={telemetry.stored} /><Metric label="Letzter Zugriff" value={telemetry.lastAccess} /></div><p className="mt-4 text-xs text-slate-500">Nutzerpräferenzen und Erinnerungsinhalte werden nicht angezeigt, weil der vorhandene Status-Endpunkt keine freigegebenen Inhalte liefert.</p></section> }
function Metric({ label, value }: { label: string; value: string }) { return <div className="border border-white/10 bg-black/15 p-3"><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-sm text-slate-100">{value}</p></div> }
