import {
  AlertTriangle,
  Bot,
  CalendarClock,
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  Mail,
  Mic,
  Play,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  SquareCode,
  Volume2
} from 'lucide-react'
import { Badge } from '@nous-research/ui/ui/components/badge'
import { Button } from '@nous-research/ui/ui/components/button'
import { Card, CardContent, CardHeader, CardTitle } from '@nous-research/ui/ui/components/card'
import { Spinner } from '@nous-research/ui/ui/components/spinner'
import type { JarvisAgentSpec, JarvisOrchestrationResponse, JarvisStatusResponse } from '@/lib/api'
import { cn } from '@/lib/utils'

const AGENT_ICONS: Record<string, typeof Bot> = {
  instagram: Sparkles,
  email: Mail,
  research: Search,
  business: CalendarClock
}
const AGENT_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  email: 'E-Mail',
  research: 'Recherche',
  business: 'Business'
}
type BadgeTone = 'success' | 'warning' | 'destructive' | undefined

interface JarvisDashboardProps {
  status: JarvisStatusResponse | null
  loading: boolean
  busy: 'plan' | 'run' | null
  selectedAgent: string
  request: string
  payloadText: string
  payload: Record<string, unknown> | null
  result: JarvisOrchestrationResponse | null
  error: string
  voiceBusy: 'recording' | 'transcribing' | 'speaking' | null
  autoSpeak: boolean
  onNavigate: (path: string) => void
  onRequestChange: (value: string) => void
  onPayloadChange: (value: string) => void
  onAgentSelect: (id: string) => void
  onRun: (mode: 'plan' | 'run') => void
  onRecordVoice: () => void
  onSpeak: (text: string) => void
  onAutoSpeakChange: (value: boolean) => void
  onApprovalDecision: (id: string, decision: 'approve' | 'deny') => void
  onRoutingModeChange: (mode: string) => void
}

export function JarvisDashboard(props: JarvisDashboardProps) {
  const agents = props.status?.agents ?? []
  const approvals =
    props.result?.consolidated?.approval_required ??
    props.result?.results?.flatMap(item => item.approval_required) ??
    []
  const missing = props.result?.consolidated?.missing_integrations ?? props.result?.missing_integrations ?? []
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 text-slate-100">
      <StatusMetrics loading={props.loading} status={props.status} />
      <section className="grid min-h-0 gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(22rem,0.8fr)]">
        <RequestPanel agents={agents} {...props} />
        <div className="grid gap-5">
          <AgentPanel agents={agents} loading={props.loading} />
          <VoicePanel {...props} />
        </div>
      </section>
      <section className="grid gap-5 xl:grid-cols-3">
        <ResultPanel result={props.result} />
        <div className="grid gap-5">
          <ApprovalPanel
            approvals={approvals}
            pending={props.status?.approvals.pending ?? []}
            onDecision={props.onApprovalDecision}
          />
          <IntegrationPanel integrations={props.status?.integrations ?? []} missing={missing} />
        </div>
      </section>
      <ConfigurationPanels status={props.status} onRoutingModeChange={props.onRoutingModeChange} />
      <WorkflowPanels status={props.status} onNavigate={props.onNavigate} />
      <RunsPanel runs={props.status?.runs ?? []} />
    </div>
  )
}

function StatusMetrics({ loading, status }: Pick<JarvisDashboardProps, 'loading' | 'status'>) {
  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      <Metric
        icon={ShieldCheck}
        label="Hermes"
        value={status ? 'bereit' : loading ? 'lädt' : 'Fehler'}
        tone={status ? 'success' : 'warning'}
      />
      <Metric
        icon={Bot}
        label="Orchestrator"
        value={status?.orchestrator.available ? 'verfügbar' : 'nicht verfügbar'}
        tone={status?.orchestrator.available ? 'success' : 'destructive'}
      />
      <Metric icon={Cpu} label="Modellroute" value={String(status?.config.specialist_model ?? 'unbekannt')} />
      <Metric icon={Database} label="Routing" value={String(status?.config.routing_mode ?? 'local_first')} />
      <Metric
        icon={Clock}
        label="Automationen"
        value={String(status?.automations.count ?? 0)}
        tone={(status?.automations.count ?? 0) > 0 ? 'success' : undefined}
      />
    </section>
  )
}

function RequestPanel({
  agents,
  busy,
  error,
  onAgentSelect,
  onNavigate,
  onPayloadChange,
  onRequestChange,
  onRun,
  payload,
  payloadText,
  request,
  selectedAgent,
  status
}: JarvisDashboardProps & { agents: JarvisAgentSpec[] }) {
  return (
    <Card className="border-white/10 bg-slate-950/80">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-xl text-slate-50">Jarvis</CardTitle>
            <p className="mt-1 text-sm text-slate-400">
              Deutschsprachige Planung, sichere Entwürfe und kontrollierte Agentenläufe.
            </p>
          </div>
          <Button size="sm" outlined onClick={() => onNavigate('/chat')}>
            <Send className="h-4 w-4" />
            Chat
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-5">
          <div className="sm:col-span-3">
            <label className="mb-1 block text-xs text-slate-400" htmlFor="jarvis-request">
              Aufgabe
            </label>
            <textarea
              id="jarvis-request"
              value={request}
              onChange={event => onRequestChange(event.target.value)}
              className="min-h-32 w-full resize-y border border-white/10 bg-black/30 p-3 text-sm text-slate-100 outline-none focus:border-slate-400"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs text-slate-400" htmlFor="jarvis-payload">
              Kontext JSON
            </label>
            <textarea
              id="jarvis-payload"
              value={payloadText}
              onChange={event => onPayloadChange(event.target.value)}
              className={cn(
                'min-h-32 w-full resize-y border bg-black/30 p-3 font-mono text-xs text-slate-100 outline-none',
                payload ? 'border-white/10 focus:border-slate-400' : 'border-red-400/70'
              )}
              spellCheck={false}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AgentButton id="auto" selected={selectedAgent} onSelect={onAgentSelect} label="Auto" icon={Bot} />
          {agents.map(agent => (
            <AgentButton
              key={agent.agent_id}
              id={agent.agent_id}
              selected={selectedAgent}
              onSelect={onAgentSelect}
              label={agentTitle(agent)}
              icon={AGENT_ICONS[agent.agent_id] ?? Bot}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => onRun('plan')} disabled={!!busy || !status?.orchestrator.available}>
            {busy === 'plan' ? <Spinner /> : <SquareCode className="h-4 w-4" />}Planen
          </Button>
          <Button onClick={() => onRun('run')} disabled={!!busy || !status?.orchestrator.available}>
            {busy === 'run' ? <Spinner /> : <Play className="h-4 w-4" />}Ausführen
          </Button>
        </div>
        {error && (
          <div className="flex items-start gap-2 border border-red-400/40 bg-red-950/30 p-3 text-sm text-red-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function AgentPanel({ agents, loading }: { agents: JarvisAgentSpec[]; loading: boolean }) {
  return (
    <Card className="border-white/10 bg-slate-950/80">
      <CardHeader>
        <CardTitle className="text-base text-slate-50">Agenten</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Spinner /> Lade Agenten
          </div>
        ) : agents.length ? (
          agents.map(agent => <AgentRow key={agent.agent_id} agent={agent} />)
        ) : (
          <p className="text-sm text-slate-400">Keine Agenten verfügbar.</p>
        )}
      </CardContent>
    </Card>
  )
}

function AgentRow({ agent }: { agent: JarvisAgentSpec }) {
  const Icon = AGENT_ICONS[agent.agent_id] ?? Bot
  return (
    <div className="border border-white/10 bg-white/[0.03] p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-slate-300" />
          <span className="font-medium">{agentTitle(agent)}</span>
        </div>
        <Badge>{agent.model_route}</Badge>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-slate-400">{agent.scope}</p>
    </div>
  )
}

function VoicePanel({
  autoSpeak,
  onAutoSpeakChange,
  onRecordVoice,
  onSpeak,
  result,
  status,
  voiceBusy
}: Pick<
  JarvisDashboardProps,
  'autoSpeak' | 'onAutoSpeakChange' | 'onRecordVoice' | 'onSpeak' | 'result' | 'status' | 'voiceBusy'
>) {
  const summary = result?.consolidated?.summary
  const isListening = voiceBusy === 'recording' || voiceBusy === 'transcribing'
  return (
    <Card className="border-white/10 bg-slate-950/80">
      <CardHeader>
        <CardTitle className="text-base text-slate-50">Voice</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
        <VoiceLine
          icon={Mic}
          label="STT"
          provider={status?.voice.stt.provider}
          configured={!!status?.voice.stt.configured}
        />
        <VoiceLine
          icon={Volume2}
          label="TTS"
          provider={status?.voice.tts.provider}
          configured={!!status?.voice.tts.configured}
        />
        <div className="flex flex-wrap gap-2 pt-2">
          <Button size="sm" outlined onClick={onRecordVoice} disabled={!!voiceBusy}>
            {isListening ? <Spinner /> : <Mic className="h-4 w-4" />}
            {voiceBusy === 'recording' ? 'Aufnahme' : voiceBusy === 'transcribing' ? 'STT' : 'Sprechen'}
          </Button>
          <Button size="sm" outlined onClick={() => summary && onSpeak(summary)} disabled={!!voiceBusy || !summary}>
            {voiceBusy === 'speaking' ? <Spinner /> : <Volume2 className="h-4 w-4" />}Vorlesen
          </Button>
          <label className="flex items-center gap-2 text-xs text-slate-400">
            <input type="checkbox" checked={autoSpeak} onChange={event => onAutoSpeakChange(event.target.checked)} />
            automatisch
          </label>
        </div>
      </CardContent>
    </Card>
  )
}

function ResultPanel({ result }: Pick<JarvisDashboardProps, 'result'>) {
  return (
    <Card className="border-white/10 bg-slate-950/80 xl:col-span-2">
      <CardHeader>
        <CardTitle className="text-base text-slate-50">Ergebnis</CardTitle>
      </CardHeader>
      <CardContent>
        {result ? <JsonBlock value={result} /> : <p className="text-sm text-slate-400">Noch kein Agentenlauf.</p>}
        {result?.token_policy && (
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <PolicyPill label="Prompt" value={String(result.token_policy.estimated_prompt_tokens ?? 'unbekannt')} />
            <PolicyPill label="Budget" value={String(result.token_policy.max_prompt_tokens ?? 'unbekannt')} />
            <PolicyPill label="Kompression" value={String(result.token_policy.compression_hint ?? 'none')} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ApprovalPanel({
  approvals,
  pending,
  onDecision
}: {
  approvals: Array<Record<string, unknown>>
  pending: JarvisStatusResponse['approvals']['pending']
  onDecision: (id: string, decision: 'approve' | 'deny') => void
}) {
  return (
    <Card className="border-white/10 bg-slate-950/80">
      <CardHeader>
        <CardTitle className="text-base text-slate-50">Freigaben</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {pending.map(item => (
          <div key={item.id} className="border border-amber-300/30 bg-amber-950/20 p-3 text-xs text-amber-100">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-medium">{item.action}</div>
                <div className="mt-1 text-amber-100/80">{item.reason}</div>
              </div>
              <Badge tone="warning">pending</Badge>
            </div>
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={() => onDecision(item.id, 'approve')}>
                Genehmigen
              </Button>
              <Button size="sm" outlined onClick={() => onDecision(item.id, 'deny')}>
                Ablehnen
              </Button>
            </div>
          </div>
        ))}
        {approvals.length ? (
          approvals.map((item, index) => (
            <div key={index} className="border border-amber-300/30 bg-amber-950/20 p-3 text-xs text-amber-100">
              <JsonBlock value={item} />
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-400">Keine offenen Freigaben aus dem letzten Lauf.</p>
        )}
      </CardContent>
    </Card>
  )
}

function IntegrationPanel({
  integrations,
  missing
}: {
  integrations: JarvisStatusResponse['integrations']
  missing: string[]
}) {
  return (
    <Card className="border-white/10 bg-slate-950/80">
      <CardHeader>
        <CardTitle className="text-base text-slate-50">Integrationen</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {integrations.map(item => (
          <div
            key={item.id}
            className="flex items-start justify-between gap-3 border border-white/10 bg-white/[0.03] p-3"
          >
            <div>
              <div className="text-sm font-medium">{item.label}</div>
              <div className="mt-1 text-xs text-slate-400">{item.reason}</div>
            </div>
            <Badge tone={statusTone(item.status)}>{item.status}</Badge>
          </div>
        ))}
        {missing.length > 0 && (
          <div className="border border-amber-300/30 bg-amber-950/20 p-3 text-sm text-amber-100">
            Fehlt im letzten Lauf: {missing.join(', ')}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ConfigurationPanels({
  status,
  onRoutingModeChange
}: Pick<JarvisDashboardProps, 'status' | 'onRoutingModeChange'>) {
  return (
    <section className="grid gap-5 lg:grid-cols-2">
      <Card className="border-white/10 bg-slate-950/80">
        <CardHeader>
          <CardTitle className="text-base text-slate-50">Modelle</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ModelGroup title="Lokal" rows={status?.models.local ?? []} />
          <ModelGroup title="Cloud / konfiguriert" rows={status?.models.cloud ?? []} />
          <p className="text-xs text-slate-500">{status?.models.note ?? 'Modellinventar nicht geladen.'}</p>
        </CardContent>
      </Card>
      <Card className="border-white/10 bg-slate-950/80">
        <CardHeader>
          <CardTitle className="text-base text-slate-50">Budgets</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          <PolicyPill label="Prompt-Tokens" value={String(status?.config.max_prompt_tokens ?? '4000')} />
          <PolicyPill label="Antwort-Tokens" value={String(status?.config.max_completion_tokens ?? '1200')} />
          <PolicyPill label="Kostenlimit" value={String(status?.config.max_estimated_cost_usd ?? '0')} />
          <PolicyPill label="Fallback" value={String(status?.config.routing_mode ?? 'local_first')} />
          <div className="border border-white/10 bg-white/[0.03] p-3 sm:col-span-2">
            <label className="mb-1 block text-xs text-slate-500" htmlFor="jarvis-routing-mode">
              Routingmodus
            </label>
            <select
              id="jarvis-routing-mode"
              value={String(status?.config.routing_mode ?? 'local_first')}
              onChange={event => onRoutingModeChange(event.target.value)}
              className="w-full border border-white/10 bg-black/30 p-2 text-sm text-slate-100"
            >
              <option value="local_only">local_only</option>
              <option value="local_first">local_first</option>
              <option value="smart">smart</option>
              <option value="cloud">cloud</option>
            </select>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}

function WorkflowPanels({ onNavigate, status }: Pick<JarvisDashboardProps, 'onNavigate' | 'status'>) {
  const jobs = status?.automations.jarvis_jobs ?? []
  return (
    <section className="grid gap-5 lg:grid-cols-2">
      <Card className="border-white/10 bg-slate-950/80">
        <CardHeader>
          <CardTitle className="text-base text-slate-50">Morgenbriefing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <CheckCircle2 className="h-4 w-4 text-emerald-300" />
            Skill: {status?.skill.available ? 'vorhanden' : 'nicht gefunden'}
          </div>
          <div className="text-sm text-slate-400">
            Zeitzone: {String(status?.config.timezone ?? 'unbekannt')} · Sprache:{' '}
            {String(status?.config.language ?? 'de')}
          </div>
          <Button size="sm" outlined onClick={() => onNavigate('/cron')}>
            <Clock className="h-4 w-4" />
            Cron
          </Button>
        </CardContent>
      </Card>
      <Card className="border-white/10 bg-slate-950/80">
        <CardHeader>
          <CardTitle className="text-base text-slate-50">Aufgaben und Workflows</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {jobs.length ? (
            jobs.map(job => (
              <div
                key={job.id}
                className="flex items-center justify-between gap-3 border border-white/10 bg-white/[0.03] p-3"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{job.name || job.id}</div>
                  <div className="truncate text-xs text-slate-400">
                    {job.schedule_display || job.state || 'ohne Zeitplan'}
                  </div>
                </div>
                <Badge tone={job.enabled ? 'success' : 'warning'}>{job.enabled ? 'aktiv' : 'pausiert'}</Badge>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-400">Keine Jarvis-Automationen gefunden.</p>
          )}
        </CardContent>
      </Card>
    </section>
  )
}

function RunsPanel({ runs }: { runs: JarvisStatusResponse['runs'] }) {
  return (
    <Card className="border-white/10 bg-slate-950/80">
      <CardHeader>
        <CardTitle className="text-base text-slate-50">Letzte Jarvis-Läufe</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {runs.length ? (
          runs.slice(0, 8).map((run, index) => (
            <div
              key={`${run.created_at}-${index}`}
              className="grid gap-2 border border-white/10 bg-white/[0.03] p-3 text-sm md:grid-cols-[8rem_minmax(0,1fr)_auto]"
            >
              <div className="text-xs text-slate-400">{new Date(run.created_at * 1000).toLocaleString()}</div>
              <div className="min-w-0">
                <div className="truncate text-slate-200">{run.request || '(ohne Request)'}</div>
                <div className="mt-1 text-xs text-slate-500">{run.agents.join(', ') || 'keine Agenten'}</div>
              </div>
              <Badge tone={statusTone(run.status)}>{run.status}</Badge>
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-400">Noch keine gespeicherten Jarvis-Läufe.</p>
        )}
      </CardContent>
    </Card>
  )
}

function statusTone(status: string): BadgeTone {
  if (['available', 'configured', 'completed', 'drafted', 'summarized', 'planned'].includes(status)) return 'success'
  if (['not_configured', 'unknown', 'blocked'].includes(status)) return 'warning'
  if (['disabled', 'error', 'failed', 'missing'].includes(status)) return 'destructive'
  return undefined
}
function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words border border-white/10 bg-black/30 p-3 text-xs leading-relaxed text-slate-200">
      {JSON.stringify(value, null, 2)}
    </pre>
  )
}
function Metric({
  icon: Icon,
  label,
  value,
  tone
}: {
  icon: typeof Bot
  label: string
  value: string
  tone?: BadgeTone
}) {
  return (
    <div className="flex min-h-24 flex-col justify-between border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between gap-3">
        <Icon className="h-4 w-4 text-slate-300" />
        <Badge tone={tone}>{value}</Badge>
      </div>
      <div className="text-sm text-slate-300">{label}</div>
    </div>
  )
}
function PolicyPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-white/10 bg-white/[0.03] p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 truncate text-sm text-slate-200">{value}</div>
    </div>
  )
}
function ModelGroup({ title, rows }: { title: string; rows: JarvisStatusResponse['models']['local'] }) {
  return (
    <div>
      <div className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-slate-500">{title}</div>
      <div className="space-y-2">
        {rows.length ? (
          rows.slice(0, 4).map(row => (
            <div key={`${title}-${row.provider}`} className="border border-white/10 bg-white/[0.03] p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 truncate text-sm font-medium">{row.label || row.provider}</div>
                <Badge tone={row.authenticated ? 'success' : 'warning'}>
                  {row.authenticated ? 'bereit' : 'nicht konfiguriert'}
                </Badge>
              </div>
              <div className="mt-1 truncate text-xs text-slate-400">
                {row.models.length ? row.models.slice(0, 4).join(', ') : 'Keine Modelle gemeldet'}
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-400">Keine Einträge.</p>
        )}
      </div>
    </div>
  )
}
function AgentButton({
  id,
  selected,
  onSelect,
  label,
  icon: Icon
}: {
  id: string
  selected: string
  onSelect: (id: string) => void
  label: string
  icon: typeof Bot
}) {
  return (
    <Button size="sm" outlined={selected !== id} onClick={() => onSelect(id)} aria-pressed={selected === id}>
      <Icon className="h-4 w-4" />
      {label}
    </Button>
  )
}
function VoiceLine({
  icon: Icon,
  label,
  provider,
  configured
}: {
  icon: typeof Bot
  label: string
  provider?: string | null
  configured: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3 border border-white/10 bg-white/[0.03] p-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-slate-300" />
        <span className="text-sm">{label}</span>
      </div>
      <Badge tone={configured ? 'success' : 'warning'}>{provider || 'nicht konfiguriert'}</Badge>
    </div>
  )
}
function agentTitle(agent: JarvisAgentSpec): string {
  return AGENT_LABELS[agent.agent_id] ?? agent.title
}
