import type { JarvisNotification } from './notification-center'
export interface JarvisNotificationPanel { style: 'dark-glass-hologram'; notifications: JarvisNotification[]; unreadCount: number }
export function createJarvisNotificationPanel(notifications: JarvisNotification[]): JarvisNotificationPanel { return { style: 'dark-glass-hologram', notifications, unreadCount: notifications.filter(item => !item.read).length } }
