import { ConnectionManager, type ConnectionState } from './connection-manager'
import { NotificationCenter } from './notification-center'
import { VoiceShortcut, type VoiceShortcutBridge } from './voice-shortcut'

export interface DesktopStatus { online: boolean; serverConnected: boolean; jarvisMode: 'idle' | 'active' | 'listening' | 'working' }
export interface DesktopRuntimeEvent { type: 'connection_changed' | 'mode_changed' | 'notification'; timestamp: string; payload?: Record<string, unknown> }

export class JarvisDesktopRuntime {
  readonly connection = new ConnectionManager()
  readonly notifications = new NotificationCenter()
  readonly voiceShortcut: VoiceShortcut
  private status: DesktopStatus = { online: true, serverConnected: false, jarvisMode: 'idle' }
  private listeners = new Set<(event: DesktopRuntimeEvent) => void>()

  constructor(voiceBridge?: VoiceShortcutBridge) { this.voiceShortcut = new VoiceShortcut(voiceBridge); this.connection.subscribe(state => this.syncConnection(state)) }
  getStatus(): DesktopStatus { return this.status }
  setMode(jarvisMode: DesktopStatus['jarvisMode']): void { this.status = { ...this.status, jarvisMode }; this.publish({ type: 'mode_changed', timestamp: new Date().toISOString(), payload: { jarvisMode } }) }
  subscribe(listener: (event: DesktopRuntimeEvent) => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener) }
  private syncConnection(state: ConnectionState): void { this.status = { ...this.status, serverConnected: state === 'connected' }; this.publish({ type: 'connection_changed', timestamp: new Date().toISOString(), payload: { state } }) }
  private publish(event: DesktopRuntimeEvent): void { this.listeners.forEach(listener => listener(event)) }
}
