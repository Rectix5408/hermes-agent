import { updateApproval } from './approval-store'
import { permissionForRisk } from './permission-model'
import { classifyRisk } from './risk-classifier'
import type { ApprovalRequest } from './types'
export function evaluateAction(action: string, agent: string): ApprovalRequest { const risk = classifyRisk(action); return { id: crypto.randomUUID(), action, agent, risk, permission: permissionForRisk(risk), status: 'pending' } }
export function requiresApproval(request: ApprovalRequest): boolean { return request.permission === 'approval_required' || request.permission === 'blocked' }
export function approve(id: string): void { updateApproval(id, 'approved') }
export function reject(id: string): void { updateApproval(id, 'rejected') }
