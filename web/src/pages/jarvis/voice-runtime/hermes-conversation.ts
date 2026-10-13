/**
 * Hermes-native voice turns. The existing JSON-RPC gateway owns model, memory,
 * tools and authorization. Voice may answer ONLY a bound, server-originated
 * approval with an explicit one-time UI choice; speech NEVER grants consent.
 */
export type VoiceTurnResult = { text: string; sessionId: string; storedSessionId: string }
export type VoiceApprovalChoice = 'once' | 'deny'
export interface VoiceApprovalDisplay {
  id: string
  command: string
  description: string
  toolName: string
  allowOnce: boolean
}
export interface VoiceToolActivity { name: string; status: 'started' | 'finished' }

type Event = { type: string; session_id?: string; payload?: unknown }
type ServerQuestion = {
  id: string
  method: string
  params: { session_id?: string; [key: string]: unknown }
  respond: (answer: Record<string, unknown>) => void
  fail: (code: number, message: string) => void
}
export interface VoiceGateway {
  connect(): Promise<void>
  request<T>(method: string, params?: Record<string, unknown>, timeoutMs?: number, signal?: AbortSignal): Promise<T>
  onAny(handler: (event: Event) => void): () => void
  onRequest(handler: (request: ServerQuestion) => boolean | void): () => void
  onState?(handler: (state: string) => void): () => void
  close(): void
}

const RESPONSE_TIMEOUT_MS = 180_000
const MAX_INPUT_CHARS = 8_000
const MAX_REPLY_CHARS = 12_000
const MAX_APPROVAL_TEXT_CHARS = 1200

type SessionCreated = { session_id: string; stored_session_id: string }
type PromptAccepted = { status?: 'streaming' | 'queued' | 'steered' | 'redirected' }
type CompletedPayload = { text?: unknown; status?: string | null; error?: string | null }
interface PendingApproval {
  question: ServerQuestion
  sessionId: string
  allowOnce: boolean
  canDeny: boolean
}

function interrupted(): DOMException { return new DOMException('Sprachanfrage abgebrochen', 'AbortError') }
function normalizedReply(payload: CompletedPayload, deltas: string): string {
  const complete = typeof payload.text === 'string' ? payload.text : ''
  return (complete || deltas).trim().slice(0, MAX_REPLY_CHARS)
}
function safeDisplay(value: unknown): string {
  return typeof value === 'string' ? value.slice(0, MAX_APPROVAL_TEXT_CHARS) : ''
}

function hasInvalidControl(text: string): boolean {
  return Array.from(text).some(char => {
    const code = char.charCodeAt(0)
    return code === 127 || (code < 32 && ![9, 10, 13].includes(code))
  })
}

function completedReply(answer: CompletedPayload, streamed: string): string {
  if (answer.status === 'error' || answer.status === 'interrupted')
    throw new Error('Hermes konnte die Anfrage nicht erfolgreich abschließen. Bitte Provider und Verbindung prüfen.')
  const reply = normalizedReply(answer, streamed)
  if (!reply) throw new Error('Hermes hat keine sprechbare Antwort zurückgegeben.')
  return reply
}

/** Bound the handshake as well as the agent turn; never leave capture locked. */
async function connectGateway(client: VoiceGateway, signal: AbortSignal): Promise<void> {
  signal.throwIfAborted()
  let abort!: () => void
  const stopped = new Promise<never>((_, reject) => {
    abort = () => { client.close(); reject(interrupted()) }
    signal.addEventListener('abort', abort, { once: true })
  })
  try {
    await Promise.race([client.connect().then(() => {
      // A transport may finish authenticating after the user has cancelled.
      if (signal.aborted) { client.close(); throw interrupted() }
    }), stopped])
  } finally { signal.removeEventListener('abort', abort) }
}

export class HermesVoiceConversation {
  private gateway: VoiceGateway | null = null
  private sessionId = ''
  private storedSessionId = ''
  private active = false
  private disposed = false
  private initializing: Promise<void> | null = null
  private pendingApproval: PendingApproval | null = null
  private unsubscribeConnection: (() => void) | undefined
  private readonly lifecycle = new AbortController()
  private readonly profile: string
  private readonly makeGateway: () => VoiceGateway
  private readonly onApprovalChanged: (approval: VoiceApprovalDisplay | null) => void

  constructor(profile: string, makeGateway: () => VoiceGateway,
    onApprovalChanged: (approval: VoiceApprovalDisplay | null) => void = () => {}) {
    if (!profile || hasInvalidControl(profile) || /[\s/?#\\]/.test(profile)) throw new Error('Ungültiges Hermes-Profil')
    this.profile = profile
    this.makeGateway = makeGateway
    this.onApprovalChanged = onApprovalChanged
  }

  private clearApproval(): void {
    // Clear the visual decision card, NOT the backend request. Callers settle
    // or fail the pending server request before clearing the reference.
    this.pendingApproval = null
    this.onApprovalChanged(null)
  }

  private denyPending(reason: string): void {
    const pending = this.pendingApproval
    if (!pending) return
    this.clearApproval()
    try {
      if (pending.canDeny) pending.question.respond({ choice: 'deny' })
      else pending.question.fail(403, reason)
    } catch { /* Disconnected transport: backend deadline remains authoritative. */ }
  }

  /** An explicit UI click only. Unrecognized, stale and permanent grants fail closed. */
  decideApproval(id: string, choice: VoiceApprovalChoice): boolean {
    const pending = this.pendingApproval
    if (!this.active || this.disposed || !pending || pending.sessionId !== this.sessionId || pending.question.id !== id)
      return false
    if (choice !== 'deny' && (choice !== 'once' || !pending.allowOnce)) return false
    this.clearApproval()
    try {
      if (choice === 'deny' && !pending.canDeny) pending.question.fail(403, 'Jarvis Voice: approval denied')
      else pending.question.respond({ choice, all: false })
      return true
    } catch {
      return false
    }
  }

  private async ensureSession(signal: AbortSignal): Promise<void> {
    if (this.disposed) throw new Error('Die Jarvis-Sprachsitzung wurde geschlossen.')
    if (this.sessionId) return
    if (this.initializing) return this.initializing
    signal = AbortSignal.any([signal, AbortSignal.timeout(45_000)])
    this.initializing = (async () => {
      const client = this.gateway ?? this.makeGateway()
      this.gateway = client
      this.unsubscribeConnection?.()
      this.unsubscribeConnection = client.onState?.(state => {
        if ((state === 'closed' || state === 'error') && !this.active) {
          // A dropped idle connection must not consume the next spoken turn.
          this.sessionId = ''
          this.gateway = null
        }
      })
      await connectGateway(client, signal)
      if (signal.aborted) throw interrupted()
      const result = await client.request<SessionCreated>(this.storedSessionId ? 'session.resume' : 'session.create', {
        profile: this.profile,
        source: 'desktop',
        ...(this.storedSessionId ? { session_id: this.storedSessionId, omit_messages: true, inline_images: false } : { title: 'Jarvis – Sprache' }),
        close_on_disconnect: true,
      }, 45_000, signal)
      if (!result.session_id || !result.stored_session_id) throw new Error('Hermes hat keine gültige Sitzung geliefert.')
      if (signal.aborted) throw interrupted()
      this.sessionId = result.session_id
      this.storedSessionId = result.stored_session_id
    })().catch(error => {
      this.unsubscribeConnection?.()
      this.unsubscribeConnection = undefined
      this.gateway?.close()
      this.gateway = null
      throw error
    }).finally(() => { this.initializing = null })
    return this.initializing
  }

  async submit(spokenText: string, signal?: AbortSignal, onTextChanged: (text: string, delta?: string) => void = () => {}, onToolActivity: (activity: VoiceToolActivity) => void = () => {}): Promise<VoiceTurnResult> {
    if (this.active) throw new Error('Jarvis bearbeitet bereits eine Sprachanfrage.')
    if (this.disposed) throw new Error('Die Jarvis-Sprachsitzung wurde geschlossen.')
    const text = spokenText.trim()
    if (!text || text.length > MAX_INPUT_CHARS || hasInvalidControl(text))
      throw new Error('Der erkannte Sprachtext ist leer, zu lang oder ungültig.')
    if (signal?.aborted) throw interrupted()
    signal = AbortSignal.any([this.lifecycle.signal, ...(signal ? [signal] : [])])

    this.active = true
    try {
      await this.ensureSession(signal)
      if (signal?.aborted || this.disposed) throw interrupted()
      const gateway = this.gateway!
      const sessionId = this.sessionId
      let unsubscribeEvent: (() => void) | undefined
      let unsubscribeQuestion: (() => void) | undefined
      let unsubscribeState: (() => void) | undefined
      let abortHandler: (() => void) | undefined
      let timeout: ReturnType<typeof setTimeout> | undefined
      let settled = false
      let streamed = ''
      let unsupportedQuestion = false
      let settle!: (value: CompletedPayload) => void
      let fail!: (reason: unknown) => void
      const completion = new Promise<CompletedPayload>((resolve, reject) => {
        settle = value => { if (!settled) { settled = true; resolve(value) } }
        fail = reason => { if (!settled) { settled = true; reject(reason) } }
      })
      // Completion may fail before prompt.submit returns its admission reply.
      void completion.catch(() => {})
      try {
        unsubscribeQuestion = gateway.onRequest(question => {
          if (settled || signal?.aborted || question.params.session_id !== sessionId) return false
          if (question.method !== 'approval') {
            unsupportedQuestion = true
            question.fail(403, 'Dieser Fragetyp wird im Jarvis-Sprachmodus nicht unterstützt.')
            return true
          }
          if (this.pendingApproval || !question.id || !Array.isArray(question.params.choices)) {
            unsupportedQuestion = true
            question.fail(403, 'Ungültige oder gleichzeitig eintreffende Tool-Freigabe.')
            return true
          }
          const choices = question.params.choices
          const allowOnce = choices.includes('once')
          const canDeny = choices.includes('deny')
          // No permanent or session-wide grant through Voice, ever. A tool must
          // offer a safe denial path, otherwise refuse the server question.
          if (!canDeny) {
            unsupportedQuestion = true
            question.fail(403, 'Freigabe ohne Ablehnungsoption wird nicht unterstützt.')
            return true
          }
          this.pendingApproval = { question, sessionId, allowOnce, canDeny }
          this.onApprovalChanged({
            id: question.id,
            command: safeDisplay(question.params.command),
            description: safeDisplay(question.params.description),
            toolName: safeDisplay(question.params.tool_name),
            allowOnce,
          })
          return true
        })
        unsubscribeState = gateway.onState?.(state => {
          if (state === 'closed' || state === 'error')
            fail(new Error('Die Hermes-Verbindung wurde unterbrochen. Es wird nichts automatisch wiederholt.'))
        })
        unsubscribeEvent = gateway.onAny(event => {
          if (settled || signal?.aborted || event.session_id !== sessionId) return
          if (event.type === 'request.cancel') {
            const payload = (event.payload ?? {}) as { id?: unknown }
            if (payload.id === this.pendingApproval?.question.id) this.clearApproval()
          }
          if (event.type === 'message.delta') {
            const payload = event.payload as { text?: unknown } | undefined
            if (typeof payload?.text === 'string' && streamed.length < MAX_REPLY_CHARS) {
              streamed += payload.text.slice(0, MAX_REPLY_CHARS - streamed.length)
              onTextChanged(streamed, payload.text)
            }
          }
          if (event.type === 'message.complete') settle((event.payload ?? {}) as CompletedPayload)
          if (event.type === 'tool.start' || event.type === 'tool.complete') {
            const payload = event.payload as { name?: unknown } | undefined
            if (typeof payload?.name === 'string') onToolActivity({ name: payload.name.slice(0, 100), status: event.type === 'tool.start' ? 'started' : 'finished' })
          }
        })
        abortHandler = () => {
            this.denyPending('Voice request aborted')
            fail(interrupted())
            void gateway.request('session.interrupt', { profile: this.profile, session_id: sessionId }).catch(() => {})
          }
        signal.addEventListener('abort', abortHandler, { once: true })
        timeout = setTimeout(() => {
          this.denyPending('Voice request timed out')
          fail(new Error('Hermes hat die Sprachanfrage nicht rechtzeitig abgeschlossen.'))
          void gateway.request('session.interrupt', { profile: this.profile, session_id: sessionId }).catch(() => {})
        }, RESPONSE_TIMEOUT_MS)
        if (signal?.aborted) throw interrupted()
        const admitted = await gateway.request<PromptAccepted>('prompt.submit', {
          profile: this.profile,
          session_id: sessionId,
          text,
          voice_turn: true,
        }, 45_000, signal)
        if (admitted.status !== 'streaming')
          throw new Error('Hermes hat die Sprachanfrage nicht als eigenen Turn angenommen.')
        const answer = await completion
        if (signal?.aborted || this.disposed) throw interrupted()
        if (this.pendingApproval) throw new Error('Hermes hat eine offene Freigabe nicht abgeschlossen.')
        if (unsupportedQuestion) throw new Error('Hermes benötigt eine nicht unterstützte Eingabe. Bitte den regulären Chat verwenden.')
        const reply = completedReply(answer, streamed)
        return { text: reply, sessionId, storedSessionId: this.storedSessionId }
      } catch (error) {
        this.denyPending('Voice turn terminated')
        this.sessionId = ''
        // Retain only this voice session's stored ID for the next explicit turn.
        // Never replay a failed prompt or take over the PTY's active session.
        gateway.close()
        if (this.gateway === gateway) this.gateway = null
        fail(error)
        await completion.catch(() => {})
        throw error
      } finally {
        if (timeout !== undefined) clearTimeout(timeout)
        if (abortHandler) signal.removeEventListener('abort', abortHandler)
        unsubscribeEvent?.()
        unsubscribeQuestion?.()
        unsubscribeState?.()
      }
    } finally { this.active = false }
  }

  /** Release the single-writer lease before the existing PTY resumes this row. */
  async releaseForChat(signal: AbortSignal): Promise<string> {
    if (this.active || this.disposed || !this.storedSessionId) throw new Error('Sprachsitzung ist nicht zur Übergabe bereit.')
    signal = AbortSignal.any([signal, this.lifecycle.signal])
    signal.throwIfAborted()
    this.active = true
    try {
      await this.ensureSession(signal)
      const result = await this.gateway!.request<{ closed: boolean }>('session.close', { profile: this.profile, session_id: this.sessionId }, 45_000, signal)
      signal.throwIfAborted()
      if (typeof result.closed !== 'boolean') throw new Error('Sitzungsabschluss wurde nicht bestätigt.')
      const id = this.storedSessionId
      this.close()
      return id
    } finally { this.active = false }
  }

  close(): void {
    this.denyPending('Voice client closed')
    this.disposed = true
    this.lifecycle.abort()
    this.unsubscribeConnection?.()
    this.unsubscribeConnection = undefined
    this.gateway?.close()
    this.gateway = null
    this.sessionId = ''
    this.storedSessionId = ''
  }
}
