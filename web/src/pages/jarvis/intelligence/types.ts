export interface JarvisIntent { id: string; source: 'voice' | 'event' | 'task' | 'memory' | 'system'; category: 'productivity' | 'communication' | 'research' | 'coding' | 'automation' | 'personal'; confidence: number }
export interface JarvisDecision { intentId: string; priority: 'low' | 'medium' | 'high' | 'critical'; recommendedAgent?: string; recommendedAction: string; requiresApproval: boolean }
export interface MemoryContext { userPreferences: string[]; projects: string[]; recentTasks: string[] }
export interface IntelligenceResult { intent: JarvisIntent; decision: JarvisDecision; eventType: string; automationSuggestion?: string }
