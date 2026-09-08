// Únicos dos roles que existen en LeagueCore -- a propósito, no un catálogo editable (pedido
// explícito: "NO crear otros roles"). Si en el futuro hiciera falta un tercer rol, este archivo es
// el único lugar a tocar (DTOs, guard y CHECK constraint de la DB ya lo referencian desde acá).
export const USER_ROLES = ['admin', 'basico'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador',
  basico: 'Básico',
};
