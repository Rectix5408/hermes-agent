import type { ActionRisk, PermissionLevel } from './types'
export function permissionForRisk(risk: ActionRisk): PermissionLevel { if (risk === 'low') return 'automatic'; if (risk === 'medium') return 'confirmation'; if (risk === 'high') return 'approval_required'; return 'blocked' }
