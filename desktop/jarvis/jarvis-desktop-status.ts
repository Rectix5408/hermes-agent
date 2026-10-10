import type { DesktopStatus } from './desktop-runtime'
export interface JarvisDesktopStatusView { connection: 'connected' | 'offline'; mode: DesktopStatus['jarvisMode']; detail: string }
export function createJarvisDesktopStatus(status: DesktopStatus): JarvisDesktopStatusView { return { connection: status.serverConnected ? 'connected' : 'offline', mode: status.jarvisMode, detail: status.serverConnected ? 'Jarvis runtime connected' : 'Jarvis runtime unavailable' } }
