import type { DesktopStatus } from './desktop-runtime'
export interface JarvisMenuBar { label: string; status: DesktopStatus['jarvisMode']; online: boolean; actions: Array<'open' | 'toggle_voice' | 'preferences'> }
export function createJarvisMenuBar(status: DesktopStatus): JarvisMenuBar { return { label: status.online ? 'Jarvis' : 'Jarvis Offline', status: status.jarvisMode, online: status.serverConnected, actions: ['open', 'toggle_voice', 'preferences'] } }
