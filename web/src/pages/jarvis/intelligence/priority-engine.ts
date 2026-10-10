import type { JarvisRuntimeEvent } from '../runtime/event-types'
import type { JarvisIntent, JarvisDecision } from './types'
export function priorityFor(intent: JarvisIntent, event: JarvisRuntimeEvent): JarvisDecision['priority'] { const type = event.type.toUpperCase(); if (type.includes('SECURITY') || type.includes('FAILED') || type.includes('URGENT')) return 'critical'; if (event.source === 'voice' || type.includes('IMPORTANT') || intent.category === 'communication') return 'high'; if (intent.category === 'automation' || intent.category === 'productivity') return 'medium'; return 'low' }
