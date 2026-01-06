/**
 * Anchor tenant IDs for special tenants
 * These are fixed UUIDs that should never change
 */

// Tenant especial "Respeite o Homem" - Customer base de referência
// Email: respeiteohomem@gmail.com
// Plan: unlimited, is_special: true
export const RESPEITE_O_HOMEM_TENANT_ID = 'd1a4d0ed-8842-495e-b741-540a9a345b25';

// Tenant plataforma "Comando Central" - Admin do sistema
// Super admin: toniravaziojr@gmail.com
export const COMANDO_CENTRAL_TENANT_ID = 'cc000000-0000-0000-0000-000000000001';

/**
 * Check if tenant is the special Respeite o Homem tenant
 * This tenant has Z-API enabled for WhatsApp
 */
export function isRespeiteOHomemTenant(tenantId: string | undefined | null): boolean {
  return tenantId === RESPEITE_O_HOMEM_TENANT_ID;
}

/**
 * Check if tenant is the platform Comando Central tenant
 */
export function isComandoCentralTenant(tenantId: string | undefined | null): boolean {
  return tenantId === COMANDO_CENTRAL_TENANT_ID;
}
