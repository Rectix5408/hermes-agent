import type { BackgroundTask } from './types'
export class BackgroundWorker {
  private tasks: BackgroundTask[] = []
  start(agent: string): BackgroundTask { const task = { id: crypto.randomUUID(), agent, status: 'running' as const, progress: 0, startedAt: new Date().toISOString() }; this.tasks = [task, ...this.tasks]; return task }
  update(id: string, progress: number, status: BackgroundTask['status'] = 'running'): void { this.tasks = this.tasks.map(task => task.id === id ? { ...task, progress, status } : task) }
  list(): BackgroundTask[] { return this.tasks }
}
