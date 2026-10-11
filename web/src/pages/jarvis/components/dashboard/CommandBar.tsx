import { useEffect, useState } from 'react'
import { useLocation } from 'react-router'
import { ArrowRight, Mic, Search, UserRound } from 'lucide-react'
import { useProfileScope } from '@/contexts/useProfileScope'
import type { JarvisWorkspaceProps } from '../../shell-types'

export function CommandBar({ onRequestChange, onNavigate, busy }: Pick<JarvisWorkspaceProps, 'onRequestChange' | 'onNavigate' | 'busy'>) {
  const [draft, setDraft] = useState('')
  const [notice, setNotice] = useState('')
  const { profile, currentProfile } = useProfileScope()
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (hash === '#jarvis-command-console') document.getElementById('jarvis-task-input')?.focus()
  }, [pathname, hash, notice])
  return <div className="command-bar-wrap">
    <form className="command-bar" aria-label="Aufgabe vorbereiten" onSubmit={event => {
      event.preventDefault()
      if (!draft.trim() || busy) return
      onRequestChange(draft.trim())
      onNavigate('/jarvis#jarvis-command-console')
      setNotice('Aufgabe übernommen. Bitte Planen oder Ausführen bewusst wählen.')
      setDraft('')
    }}>
      <Search size={20} aria-hidden="true" />
      <input aria-label="Jarvis Command Bar" placeholder="Frag mich etwas oder gib einen Befehl ein …" value={draft} onChange={event => setDraft(event.target.value)} disabled={!!busy} />
      <button type="submit" disabled={!draft.trim() || !!busy} aria-label="Aufgabe in Konsole übernehmen"><ArrowRight size={20} /></button>
      <button type="button" onClick={() => onNavigate('/jarvis/voice')} aria-label="Voice Center öffnen"><Mic size={20} /></button>
      <span className="command-profile"><UserRound size={18} /><span>Profil<strong>{profile || currentProfile}</strong></span></span>
    </form>
    <p className="command-bar-hint" role="status">{busy ? 'Hermes bearbeitet die aktuelle Aufgabe …' : notice || 'Aufgabe vorbereiten · keine automatische Ausführung. Gespräche bleiben im Hermes Chat.'}</p>
  </div>
}
