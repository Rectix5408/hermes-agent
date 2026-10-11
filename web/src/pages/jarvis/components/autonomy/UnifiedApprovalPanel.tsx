import { useState } from 'react'
import { Button } from '@nous-research/ui/ui/components/button'
import type { JarvisApprovalRecord } from '@/lib/api'

interface Props { approvals: JarvisApprovalRecord[]; busy?: boolean; onDecision: (id: string, decision: 'approve' | 'deny') => void }
export function UnifiedApprovalPanel({ approvals, busy, onDecision }: Props) {
  const [confirmation, setConfirmation] = useState<{ id: string; decision: 'approve' | 'deny' } | null>(null)
  return <section className="command-panel" aria-label="Freigabe-Warteschlange">
    <h2>Freigaben vor externen Aktionen</h2><p>Nur vorhandene Anträge. Eine Zustimmung führt hier keine Aktion aus; Backend-Berechtigungen bleiben verbindlich.</p>
    <div className="operations-approvals">{approvals.length ? approvals.map(item => <article key={item.id}>
      <h3>{item.action}</h3><p>{item.agent_id} · {item.reason}</p>
      <time>{new Date(item.created_at * 1000).toLocaleString('de-DE')}</time>
      <details><summary>Antragsdetails prüfen</summary><p>Kennung: {item.id}</p><p>Parameterbindung: {item.params_hash}</p><pre>{JSON.stringify(item.items, null, 2)}</pre></details>
      {confirmation?.id === item.id ? <div role="group" aria-label="Entscheidung bestätigen"><p>{confirmation.decision === 'approve' ? 'Diesen konkreten Antrag erlauben?' : 'Diesen Antrag ablehnen?'}</p><Button size="sm" disabled={busy} onClick={() => { onDecision(item.id, confirmation.decision); setConfirmation(null) }}>Entscheidung bestätigen</Button><Button size="sm" outlined disabled={busy} onClick={() => setConfirmation(null)}>Abbrechen</Button></div> :
        <div className="command-actions"><Button size="sm" disabled={busy} onClick={() => setConfirmation({ id: item.id, decision: 'approve' })}>Erlauben</Button><Button size="sm" outlined disabled={busy} onClick={() => setConfirmation({ id: item.id, decision: 'deny' })}>Ablehnen</Button></div>}
    </article>) : <p>Keine externen Aktionen warten auf Freigabe.</p>}</div>
  </section>
}
