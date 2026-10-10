export interface JarvisAgent {
  id: string
  name: string
  type: 'research' | 'coding' | 'email' | 'calendar' | 'social' | 'browser' | 'memory'
  status: 'idle' | 'running' | 'waiting' | 'completed' | 'error'
  currentTask: string
  tools: string[]
  lastAction: string
}

export const AGENT_DEMO_DATA: JarvisAgent[] = [
  { id: 'research', name: 'Research Agent', type: 'research', status: 'running', currentTask: 'Suche Informationen', tools: ['Browser', 'Search'], lastAction: 'DuckDuckGo Anfrage' },
  { id: 'coding', name: 'Coding Agent', type: 'coding', status: 'idle', currentTask: 'Wartet auf Entwicklungsaufgabe', tools: ['Terminal', 'Files'], lastAction: 'Repository geprüft' },
  { id: 'email', name: 'Email Agent', type: 'email', status: 'waiting', currentTask: 'Entwurf zur Freigabe vorbereitet', tools: ['Mail', 'Contacts'], lastAction: 'Freigabe angefordert' },
  { id: 'calendar', name: 'Calendar Agent', type: 'calendar', status: 'completed', currentTask: 'Tagesplan synchronisiert', tools: ['Calendar'], lastAction: '3 Termine geprüft' },
  { id: 'social', name: 'Social Media Agent', type: 'social', status: 'idle', currentTask: 'Wartet auf Kampagnenauftrag', tools: ['Social Media Skill'], lastAction: 'Keine offene Aktion' },
  { id: 'memory', name: 'Memory Agent', type: 'memory', status: 'running', currentTask: 'Präferenzen abgleichen', tools: ['Memory', 'Knowledge Graph'], lastAction: 'Memory aktualisiert' }
]
