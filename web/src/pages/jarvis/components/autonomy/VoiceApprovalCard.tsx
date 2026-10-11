import { useState } from 'react'
import { Button } from '@nous-research/ui/ui/components/button'
import type { VoiceApprovalChoice, VoiceApprovalDisplay } from '../../voice-runtime/hermes-conversation'

interface Props {
  approval: VoiceApprovalDisplay
  onDecision: (id: string, choice: VoiceApprovalChoice) => void
}

/** An actual Hermes gateway tool decision, not a Jarvis draft-approval record. */
export function VoiceApprovalCard({ approval, onDecision }: Props) {
  const [confirmOnce, setConfirmOnce] = useState(false)
  return <section className="command-panel" role="region" aria-label="Hermes Werkzeugfreigabe" aria-live="polite">
    <h2>Jarvis benötigt deine Freigabe</h2>
    <p>Eine Hermes-Werkzeugaktion wartet auf deine Entscheidung. Spracheingaben wie „Ja“ sind keine Zustimmung.</p>
    <dl className="operations-facts">
      <div><dt>Werkzeug</dt><dd>{approval.toolName || 'Hermes-Agent'}</dd></div>
      <div><dt>Beschreibung</dt><dd>{approval.description || 'Keine weitere Beschreibung vorhanden'}</dd></div>
    </dl>
    {approval.command && <details><summary>Befehl im Detail prüfen</summary><pre className="whitespace-pre-wrap break-all">{approval.command}</pre></details>}
    {confirmOnce ? <div role="group" aria-label="Einmalige Freigabe bestätigen">
      <p>Diese konkrete Aktion <strong>einmalig</strong> zulassen? Die Genehmigung kann eine echte Änderung auslösen.</p>
      <div className="command-actions">
        <Button onClick={() => onDecision(approval.id, 'once')}>Einmalige Freigabe bestätigen</Button>
        <Button outlined onClick={() => setConfirmOnce(false)}>Zurück</Button>
        <Button outlined onClick={() => onDecision(approval.id, 'deny')}>Ablehnen</Button>
      </div>
    </div> : <div className="command-actions">
      <Button outlined onClick={() => onDecision(approval.id, 'deny')}>Ablehnen</Button>
      {approval.allowOnce && <Button onClick={() => setConfirmOnce(true)}>Einmal erlauben …</Button>}
    </div>}
    <p>Keine dauerhafte oder sitzungsweite Freigabe über Jarvis Voice.</p>
  </section>
}
