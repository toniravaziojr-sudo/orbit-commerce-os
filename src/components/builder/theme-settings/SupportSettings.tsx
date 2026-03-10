// =============================================
// SUPPORT SETTINGS - Widget de atendimento configuration
// Uses DRAFT pattern - changes saved via builder toolbar "Salvar"
// =============================================

import { useEffect, useCallback } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MessageCircle, Phone } from 'lucide-react';
import { useThemeSupportWidget, type SupportWidgetConfig, type SupportWidgetType, type SupportWidgetPosition } from '@/hooks/useThemeSettings';

interface SupportSettingsProps {
  tenantId: string;
  templateSetId?: string;
}

export function SupportSettings({ tenantId, templateSetId }: SupportSettingsProps) {
  const { supportWidget, updateSupportWidget, isLoading } = useThemeSupportWidget(tenantId, templateSetId);

  // Handle change - updates draft only (no DB save)
  const handleChange = useCallback((key: keyof SupportWidgetConfig, value: boolean | string) => {
    updateSupportWidget({ [key]: value });
  }, [updateSupportWidget]);

  const needsWhatsApp = supportWidget.type === 'whatsapp' || supportWidget.type === 'both';

  if (isLoading) {
    return <div className="h-24 animate-pulse bg-muted rounded" />;
  }

  return (
    <div className="space-y-6">
      {/* Enable/Disable */}
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-medium">Ativar widget</Label>
          <p className="text-xs text-muted-foreground">Exibir botão flutuante de atendimento</p>
        </div>
        <Switch checked={supportWidget.enabled ?? true} onCheckedChange={(v) => handleChange('enabled', v)} />
      </div>

      {supportWidget.enabled && (
        <>
          {/* Widget Type */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Tipo de atendimento</Label>
            <Select value={supportWidget.type ?? 'chat'} onValueChange={(v) => handleChange('type', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="chat">
                  <span className="flex items-center gap-2">
                    <MessageCircle className="h-3.5 w-3.5" />
                    Chat interno
                  </span>
                </SelectItem>
                <SelectItem value="whatsapp">
                  <span className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5" />
                    WhatsApp
                  </span>
                </SelectItem>
                <SelectItem value="both">
                  <span className="flex items-center gap-2">
                    <MessageCircle className="h-3.5 w-3.5" />
                    Ambos
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {supportWidget.type === 'chat' && 'Chat integrado com IA e atendimento humano'}
              {supportWidget.type === 'whatsapp' && 'Botão flutuante que abre o WhatsApp'}
              {supportWidget.type === 'both' && 'Chat interno + botão WhatsApp lado a lado'}
            </p>
          </div>

          {/* WhatsApp Number */}
          {needsWhatsApp && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Número do WhatsApp</Label>
              <Input
                placeholder="+55 11 99999-9999"
                value={supportWidget.whatsappNumber ?? ''}
                onChange={(e) => handleChange('whatsappNumber', e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Com código do país e DDD (ex: +5511999999999)
              </p>
            </div>
          )}

          {/* Default Message */}
          {needsWhatsApp && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Mensagem padrão</Label>
              <Textarea
                placeholder="Olá! Preciso de ajuda."
                value={supportWidget.whatsappMessage ?? ''}
                onChange={(e) => handleChange('whatsappMessage', e.target.value)}
                rows={2}
              />
              <p className="text-xs text-muted-foreground">
                Texto pré-preenchido ao abrir o WhatsApp
              </p>
            </div>
          )}

          {/* Button Color */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Cor do botão</Label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={supportWidget.buttonColor ?? '#25D366'}
                onChange={(e) => handleChange('buttonColor', e.target.value)}
                className="h-9 w-12 rounded border cursor-pointer"
              />
              <Input
                value={supportWidget.buttonColor ?? '#25D366'}
                onChange={(e) => handleChange('buttonColor', e.target.value)}
                className="flex-1 font-mono text-xs"
                maxLength={7}
              />
            </div>
          </div>

          {/* Position */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Posição</Label>
            <Select value={supportWidget.position ?? 'right'} onValueChange={(v) => handleChange('position', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="right">Direita</SelectItem>
                <SelectItem value="left">Esquerda</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </>
      )}
    </div>
  );
}
