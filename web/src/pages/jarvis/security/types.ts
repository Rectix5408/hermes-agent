export type PermissionLevel = 'automatic' | 'confirmation' | 'approval_required' | 'blocked'
export type ActionRisk = 'low' | 'medium' | 'high' | 'critical'
export interface ApprovalRequest { id: string; action: string; agent: string; risk: ActionRisk; permission: PermissionLevel; status: 'pending' | 'approved' | 'rejected' }
