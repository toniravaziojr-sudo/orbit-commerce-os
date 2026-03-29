/**
 * Anchor tenant IDs for special tenants
 * These are fixed UUIDs that should never change
 */

// Tenant especial "Respeite o Homem" - Customer base de referência
// Email: respeiteohomem@gmail.com
// Plan: unlimited, is_special: true
export const RESPEITE_O_HOMEM_TENANT_ID = 'd1a4d0ed-8842-495e-b741-540a9a345b25';

// Tenant especial "Amazgan" - Parceiro estratégico
// Plan: unlimited, is_special: true
export const AMAZGAN_TENANT_ID = '8023b8ed-e7d0-4dd0-8f96-014a748c267e';

// Tenant plataforma "Comando Central" - Admin do sistema
// Super admin: toniravaziojr@gmail.com
export const COMANDO_CENTRAL_TENANT_ID = 'cc000000-0000-0000-0000-000000000001';

/**
 * List of all special tenant IDs (lifetime access, no billing)
 */
export const SPECIAL_TENANT_IDS = [
  RESPEITE_O_HOMEM_TENANT_ID,
  AMAZGAN_TENANT_ID,
] as const;

/**
 * Check if tenant is a special partner tenant
 */
export function isSpecialPartnerTenant(tenantId: string | undefined | null): boolean {
  if (!tenantId) return false;
  return (SPECIAL_TENANT_IDS as readonly string[]).includes(tenantId);
}

/**
 * Check if tenant is the special Respeite o Homem tenant
 */
export function isRespeiteOHomemTenant(tenantId: string | undefined | null): boolean {
  return tenantId === RESPEITE_O_HOMEM_TENANT_ID;
}

/**
 * Check if tenant is the special Amazgan tenant
 */
export function isAmazganTenant(tenantId: string | undefined | null): boolean {
  return tenantId === AMAZGAN_TENANT_ID;
}

/**
 * Check if tenant is the platform Comando Central tenant
 */
export function isComandoCentralTenant(tenantId: string | undefined | null): boolean {
  return tenantId === COMANDO_CENTRAL_TENANT_ID;
}