/**
 * AIPipelineInfo — Exibe modelos IA utilizados
 * 
 * VISÍVEL APENAS para tenants especiais (respeiteohomem, admin)
 */

import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { isRespeiteOHomemTenant, isComandoCentralTenant } from '@/config/tenant-anchors';

interface ModelInfo {
  id: string;
  name: string;
}

interface AIPipelineInfoProps {
  label?: string;
  models: ModelInfo[];
  description?: string;
  variant?: 'outline' | 'default';
}

/**
 * Só exibe para tenants especiais
 */
export function AIPipelineInfo({ 
  label = 'Modelos IA utilizados neste pipeline:',
  models,
  description,
  variant = 'outline',
}: AIPipelineInfoProps) {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;

  // Só mostrar para tenants especiais
  const isSpecialTenant = isRespeiteOHomemTenant(tenantId) || isComandoCentralTenant(tenantId);
  
  if (!isSpecialTenant) {
    return null;
  }

  return (
    <div className="space-y-2">
      <Label className="text-muted-foreground text-xs">{label}</Label>
      <div className="flex flex-wrap gap-1">
        {models.map(m => (
          <Badge key={m.id} variant={variant} className="text-xs">
            {m.name}
          </Badge>
        ))}
      </div>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
    </div>
  );
}

/**
 * Versão simples com badges customizados
 */
interface CustomPipelineInfoProps {
  label?: string;
  children: React.ReactNode;
  description?: string;
}

export function CustomPipelineInfo({ 
  label = 'Pipeline recomendado:',
  children,
  description,
}: CustomPipelineInfoProps) {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;

  // Só mostrar para tenants especiais
  const isSpecialTenant = isRespeiteOHomemTenant(tenantId) || isComandoCentralTenant(tenantId);
  
  if (!isSpecialTenant) {
    return null;
  }

  return (
    <div className="space-y-2">
      <Label className="text-muted-foreground text-xs">{label}</Label>
      <div className="flex flex-wrap gap-1">
        {children}
      </div>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
    </div>
  );
}
