export type ContextSourceKind = 'user' | 'project' | 'memory' | 'agent' | 'permission'
export interface ContextItem { id: string; label: string; detail: string; priority: 'low' | 'medium' | 'high'; source: ContextSourceKind }
export interface JarvisContext { user: ContextItem[]; projects: ContextItem[]; preferences: ContextItem[]; rules: ContextItem[]; skills: ContextItem[]; agents: ContextItem[]; recentActivity: ContextItem[] }
export interface ContextSource { id: ContextSourceKind; label: string; available: boolean; items: ContextItem[] }
