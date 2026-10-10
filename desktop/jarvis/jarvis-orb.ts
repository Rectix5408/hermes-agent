import type { DesktopStatus } from './desktop-runtime'
export interface JarvisOrb { state: DesktopStatus['jarvisMode']; style: 'dark-glass-hologram'; animated: boolean }
export function createJarvisOrb(status: DesktopStatus): JarvisOrb { return { state: status.jarvisMode, style: 'dark-glass-hologram', animated: status.jarvisMode !== 'idle' } }
