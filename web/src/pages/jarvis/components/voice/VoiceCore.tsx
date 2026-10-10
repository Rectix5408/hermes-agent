import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { Button } from '@nous-research/ui/ui/components/button'
import { BackgroundTasks } from './BackgroundTasks'
import { VoiceConversation } from './VoiceConversation'
import { VoiceInspector } from './VoiceInspector'
import { VoiceStatus } from './VoiceStatus'
import { VoiceVisualizer } from './VoiceVisualizer'
import { VOICE_DEMO_STATE, VOICE_EVENTS, type VoiceRuntimeState } from './voice-data'

const states: VoiceRuntimeState['status'][] = ['idle', 'listening', 'thinking', 'executing', 'speaking']
export function VoiceCore() { const [status, setStatus] = useState<VoiceRuntimeState['status']>(VOICE_DEMO_STATE.status); const state = { ...VOICE_DEMO_STATE, status }; return <section className="border border-cyan-300/20 bg-slate-950/40 p-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.22em] text-cyan-300/80">Jarvis Voice Core</p><h2 className="mt-1 text-xl font-medium text-slate-100">Conversational Runtime</h2><p className="mt-1 text-sm text-slate-500">Lokaler UI-State · vorbereitet für STT, TTS und parallele Tasks</p></div><Button size="sm" outlined onClick={() => setStatus(current => states[(states.indexOf(current) + 1) % states.length])}>Status simulieren <ChevronRight className="h-4 w-4" /></Button></div><div className="mt-5 grid gap-5 xl:grid-cols-[minmax(17rem,0.8fr)_minmax(0,1fr)_minmax(17rem,0.8fr)]"><VoiceVisualizer state={state} /><div className="grid content-start gap-5"><VoiceStatus state={state} /><VoiceConversation state={state} /></div><VoiceInspector events={VOICE_EVENTS} /></div><div className="mt-5"><BackgroundTasks tasks={state.activeTasks} /></div></section> }
