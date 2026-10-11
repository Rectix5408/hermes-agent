interface Recognition {
  lang: string; continuous: boolean; interimResults: boolean
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start(): void; stop(): void; abort(): void
}

/** One bounded capture; cancellation also disposes a late permission grant. */
export function captureMicrophone(
  deviceId: string, signal: AbortSignal, onStream: (stream: MediaStream | null) => void,
): { recording: Promise<Blob>; stop: () => void } {
  let recorder: MediaRecorder | undefined
  let stopped = false
  const stop = () => { stopped = true; if (recorder?.state === 'recording') recorder.stop() }
  const recording = (async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined')
      throw new Error('Browseraufnahme benötigt HTTPS oder localhost und einen unterstützten Browser.')
    let stream: MediaStream | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      signal.throwIfAborted()
      stream = await navigator.mediaDevices.getUserMedia({ audio: deviceId ? { deviceId: { exact: deviceId } } : true })
      signal.throwIfAborted()
      if (stopped) throw new DOMException('Capture stopped', 'AbortError')
      onStream(stream)
      const mimeType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus']
        .find(type => MediaRecorder.isTypeSupported(type))
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      const active = recorder
      const blob = await new Promise<Blob>((resolve, reject) => {
        const chunks: Blob[] = []
        active.ondataavailable = event => { if (event.data.size) chunks.push(event.data) }
        active.onerror = () => reject(new Error('Die Aufnahme wurde unterbrochen. Bitte erneut starten.'))
        active.onstop = () => resolve(new Blob(chunks, { type: active.mimeType || mimeType || 'audio/webm' }))
        signal.addEventListener('abort', stop, { once: true })
        active.start()
        timer = setTimeout(stop, 60_000)
      })
      signal.throwIfAborted()
      if (!blob.size) throw new Error('Keine Audiodaten aufgenommen. Bitte erneut sprechen.')
      return blob
    } finally {
      clearTimeout(timer)
      signal.removeEventListener('abort', stop)
      if (recorder) { recorder.ondataavailable = null; recorder.onstop = null; recorder.onerror = null; stop() }
      stream?.getTracks().forEach(track => track.stop())
      onStream(null)
    }
  })()
  return { recording, stop }
}

export function captureBrowserSpeech(signal: AbortSignal): { recording: Promise<string>; stop: () => void } {
  const host = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }
  const Constructor = host.SpeechRecognition ?? host.webkitSpeechRecognition
  let recognition: Recognition | undefined
  const stop = () => recognition?.stop()
  const recording = new Promise<string>((resolve, reject) => {
    if (!Constructor) return reject(new Error('Browser-Spracherkennung ist hier nicht verfügbar. Bitte Hermes-STT wählen.'))
    signal.throwIfAborted()
    recognition = new Constructor()
    const active = recognition
    let transcript = ''
    const cleanup = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); active.onresult = null; active.onerror = null; active.onend = null }
    const abort = () => { cleanup(); active.abort(); reject(new DOMException('Cancelled', 'AbortError')) }
    active.lang = 'de-DE'; active.continuous = false; active.interimResults = false
    active.onresult = event => { transcript = Array.from(event.results).map(result => result[0]?.transcript ?? '').join(' ').trim() }
    active.onerror = event => { cleanup(); active.abort(); reject(event.error === 'not-allowed' ? new DOMException('Denied', 'NotAllowedError') : new Error('Keine Sprache erkannt oder Spracherkennung nicht erreichbar.')) }
    active.onend = () => { cleanup(); resolve(transcript) }
    signal.addEventListener('abort', abort, { once: true })
    const timer = setTimeout(() => { cleanup(); active.abort(); reject(new Error('Spracherkennung hat das Zeitlimit erreicht. Bitte erneut starten.')) }, 60_000)
    try { active.start() } catch (error) { cleanup(); reject(error) }
  })
  return { recording, stop }
}
