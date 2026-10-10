import type { ContextSource } from './context-types'
export const contextSources: ContextSource[] = [
  { id: 'user', label: 'User Context', available: true, items: [{ id: 'language', label: 'Sprache', detail: 'Deutsch', priority: 'medium', source: 'user' }, { id: 'profile', label: 'Profil', detail: 'Jarvis Operator', priority: 'high', source: 'user' }] },
  { id: 'project', label: 'Project Context', available: true, items: [{ id: 'jarvis-project', label: 'Hermes Jarvis', detail: 'Aktives Dashboard-Projekt', priority: 'high', source: 'project' }, { id: 'virus-event', label: 'VIRUS EVENT', detail: 'Veranstaltungsprojekt', priority: 'medium', source: 'project' }] },
  { id: 'memory', label: 'Memory Context', available: true, items: [{ id: 'preferences', label: 'Preferences', detail: 'Freigabeorientierter Workflow', priority: 'high', source: 'memory' }, { id: 'recent-task', label: 'Recent Task', detail: 'Morgenbriefing vorbereiten', priority: 'medium', source: 'memory' }] },
  { id: 'agent', label: 'Agent Context', available: true, items: [{ id: 'research-agent', label: 'Research Agent', detail: 'Analyse aktiv', priority: 'high', source: 'agent' }, { id: 'email-agent', label: 'Email Agent', detail: 'Wartet auf Freigabe', priority: 'medium', source: 'agent' }] },
  { id: 'permission', label: 'Permission Context', available: true, items: [{ id: 'approval-rule', label: 'External actions', detail: 'Approval required', priority: 'high', source: 'permission' }] }
]
