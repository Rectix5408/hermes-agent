export type JarvisNotificationKind = 'task_completed' | 'important_email' | 'approval_needed'
export interface JarvisNotification { id: string; kind: JarvisNotificationKind; title: string; message: string; createdAt: string; read: boolean }

export class NotificationCenter {
  private notifications: JarvisNotification[] = []
  private listeners = new Set<(items: JarvisNotification[]) => void>()

  notify(notification: Omit<JarvisNotification, 'id' | 'createdAt' | 'read'>): JarvisNotification { const item = { ...notification, id: crypto.randomUUID(), createdAt: new Date().toISOString(), read: false }; this.notifications = [item, ...this.notifications].slice(0, 50); this.publish(); return item }
  list(): JarvisNotification[] { return this.notifications }
  markRead(id: string): void { this.notifications = this.notifications.map(item => item.id === id ? { ...item, read: true } : item); this.publish() }
  subscribe(listener: (items: JarvisNotification[]) => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener) }
  private publish(): void { this.listeners.forEach(listener => listener(this.notifications)) }
}
