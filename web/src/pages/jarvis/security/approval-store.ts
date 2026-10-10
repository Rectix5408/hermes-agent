import { useSyncExternalStore } from 'react'
import type { ApprovalRequest } from './types'
let requests: ApprovalRequest[] = [{ id: 'social-publish', action: 'Instagram Post veröffentlichen', agent: 'Social Agent', risk: 'high', permission: 'approval_required', status: 'pending' }, { id: 'email-send', action: 'E-Mail senden', agent: 'Email Agent', risk: 'high', permission: 'approval_required', status: 'pending' }, { id: 'briefing-draft', action: 'Morgenbriefing Entwurf erstellen', agent: 'Calendar Agent', risk: 'medium', permission: 'confirmation', status: 'pending' }]
const listeners = new Set<() => void>()
function publish(): void { listeners.forEach(listener => listener()) }
export function getApprovals(): ApprovalRequest[] { return requests }
export function updateApproval(id: string, status: ApprovalRequest['status']): void { requests = requests.map(request => request.id === id ? { ...request, status } : request); publish() }
export function useApprovals(): ApprovalRequest[] { return useSyncExternalStore(listener => { listeners.add(listener); return () => listeners.delete(listener) }, getApprovals, () => []) }
