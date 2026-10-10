import { useSyncExternalStore } from 'react'
import { resolveContext } from './context-resolver'
import type { JarvisContext } from './context-types'
let context = resolveContext()
const listeners = new Set<() => void>()
const publish = () => listeners.forEach(listener => listener())
export function getContext(): JarvisContext { return context }
export function updateContext(next: Partial<JarvisContext>): void { context = { ...context, ...next }; publish() }
export function clearContext(): void { context = { user: [], projects: [], preferences: [], rules: [], skills: [], agents: [], recentActivity: [] }; publish() }
export function useJarvisContext(): JarvisContext { return useSyncExternalStore(listener => { listeners.add(listener); return () => listeners.delete(listener) }, getContext, () => context) }
