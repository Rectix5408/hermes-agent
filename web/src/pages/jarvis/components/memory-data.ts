export type MemoryNodeType = 'user' | 'project' | 'skill' | 'document' | 'knowledge' | 'preference' | 'agent'
export type MemoryImportance = 'low' | 'medium' | 'high'

export interface MemoryNodeData {
  id: string
  type: MemoryNodeType
  label: string
  description?: string
  importance: MemoryImportance
  lastAccess?: string
  connections: string[]
  status: 'active' | 'inactive'
}

export interface MemoryEvent {
  type: 'MEMORY_CREATED' | 'MEMORY_READ' | 'MEMORY_UPDATED' | 'MEMORY_CONNECTED'
  nodeId: string
  timestamp: number
}

export const MEMORY_NODES: MemoryNodeData[] = [
  { id: 'user', type: 'user', label: 'User', description: 'Persönlicher Wissensanker für Jarvis.', importance: 'high', lastAccess: 'Heute', connections: ['jarvis-project', 'preferences'], status: 'active' },
  { id: 'jarvis-project', type: 'project', label: 'Hermes Jarvis', description: 'Jarvis Dashboard und Agenten-Orchestrierung.', importance: 'high', lastAccess: 'Heute', connections: ['user', 'agent-architecture', 'coding-agent', 'architecture-docs'], status: 'active' },
  { id: 'virus-event', type: 'project', label: 'VIRUS EVENT', description: 'Veranstaltungsprojekt und zugehörige Automationen.', importance: 'medium', lastAccess: 'Diese Woche', connections: ['social-media', 'automation-workflow'], status: 'inactive' },
  { id: 'social-media', type: 'skill', label: 'Social Media Skill', description: 'Skill für Social-Media-Arbeitsabläufe.', importance: 'medium', lastAccess: 'Diese Woche', connections: ['virus-event', 'instagram-agent'], status: 'inactive' },
  { id: 'email-agent', type: 'skill', label: 'Email Agent', description: 'Vorbereitung und Verarbeitung von E-Mail-Aufgaben.', importance: 'medium', lastAccess: 'Heute', connections: ['jarvis-project', 'automation-workflow'], status: 'active' },
  { id: 'coding-agent', type: 'skill', label: 'Coding Agent', description: 'Unterstützung bei Entwicklung und Code-Aufgaben.', importance: 'high', lastAccess: 'Heute', connections: ['jarvis-project', 'agent-architecture'], status: 'active' },
  { id: 'token-optimization', type: 'knowledge', label: 'Token Optimization', description: 'Wissen zu effizienter Kontext- und Tool-Nutzung.', importance: 'high', lastAccess: 'Heute', connections: ['jarvis-project', 'agent-architecture'], status: 'active' },
  { id: 'agent-architecture', type: 'knowledge', label: 'Agent Architecture', description: 'Wissensmodell für Rollen, Tools und Übergaben.', importance: 'high', lastAccess: 'Heute', connections: ['jarvis-project', 'coding-agent', 'token-optimization'], status: 'active' },
  { id: 'architecture-docs', type: 'document', label: 'Architecture Docs', description: 'Technische Dokumentation der Hermes-Architektur.', importance: 'medium', lastAccess: 'Diese Woche', connections: ['jarvis-project', 'agent-architecture'], status: 'active' },
  { id: 'preferences', type: 'preference', label: 'Preferences', description: 'Gespeicherte Interaktions- und Arbeitspräferenzen.', importance: 'medium', lastAccess: 'Heute', connections: ['user'], status: 'active' },
  { id: 'instagram-agent', type: 'agent', label: 'Instagram Agent', description: 'Spezialisierter Agent für Instagram-Aufgaben.', importance: 'medium', lastAccess: 'Diese Woche', connections: ['social-media', 'automation-workflow'], status: 'inactive' },
  { id: 'automation-workflow', type: 'agent', label: 'Automation Workflow', description: 'Vorbereitete Agenten-Automation.', importance: 'low', lastAccess: 'Diese Woche', connections: ['virus-event', 'email-agent', 'instagram-agent'], status: 'inactive' }
]

export const MEMORY_EVENTS: MemoryEvent[] = [{ type: 'MEMORY_READ', nodeId: 'preferences', timestamp: Date.now() }]
