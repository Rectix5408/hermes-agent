import type { ActionRisk } from './types'
const terms: Array<{ risk: ActionRisk; matches: string[] }> = [{ risk: 'critical', matches: ['veröffentlichen', 'publish', 'löschen', 'delete', 'zahlung', 'finanz'] }, { risk: 'high', matches: ['senden', 'send', 'datei ändern', 'external', 'extern'] }, { risk: 'medium', matches: ['entwurf', 'draft', 'vorschlag', 'suggest'] }]
export function classifyRisk(action: string): ActionRisk { const text = action.toLowerCase(); return terms.find(rule => rule.matches.some(term => text.includes(term)))?.risk ?? 'low' }
