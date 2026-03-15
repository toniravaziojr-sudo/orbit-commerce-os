// =============================================
// SUPPORT SETTINGS - Widget de atendimento configuration
// Uses DRAFT pattern - changes saved via builder toolbar "Salvar"
// =============================================

import { useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MessageCircle } from 'lucide-react';
import { useThemeSupportWidget, type SupportWidgetConfig, type SupportWidgetType, type SupportWidgetPosition, type SupportWidgetButtonSize } from '@/hooks/useThemeSettings';

// WhatsApp SVG icon (reusable)
function WhatsAppIconSmall({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}

interface SupportSettingsProps {
  tenantId: string;
  templateSetId?: string;
}

/** Color picker row with swatch + hex input */
function ColorPickerRow({ 
  label, 
  value, 
  defaultValue, 
  onChange,
  icon,
}: { 
  label: string; 
  value: string | undefined; 
  defaultValue: string; 
  onChange: (color: string) => void;
  icon?: React.ReactNode;
}) {
  const color = value || defaultValue;
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium flex items-center gap-1.5">
        {icon}
        {label}
      </Label>
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={color}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 rounded border cursor-pointer"
        />
        <Input
          value={color}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 font-mono text-xs"
          maxLength={7}
        />
      </div>
    </div>
  );
}

export function SupportSettings({ tenantId, templateSetId }: SupportSettingsProps) {
  const { supportWidget, updateSupportWidget, isLoading } = useThemeSupportWidget(tenantId, templateSetId);

  // Handle change - updates draft only (no DB save)
  const handleChange = useCallback((key: keyof SupportWidgetConfig, value: boolean | string) => {
    updateSupportWidget({ [key]: value });
  }, [updateSupportWidget]);

  const widgetType = supportWidget.type ?? 'chat';
  const showWhatsApp = widgetType === 'whatsapp' || widgetType === 'both';
  const showChat = widgetType === 'chat' || widgetType === 'both';

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
            <Select value={widgetType} onValueChange={(v) => handleChange('type', v)}>
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
                    <WhatsAppIconSmall className="h-3.5 w-3.5" />
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
              {widgetType === 'chat' && 'Chat integrado com IA e atendimento humano'}
              {widgetType === 'whatsapp' && 'Botão flutuante que abre o WhatsApp'}
              {widgetType === 'both' && 'Chat interno + botão WhatsApp lado a lado'}
            </p>
          </div>

          {/* WhatsApp Settings */}
          {showWhatsApp && (
            <>
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
            </>
          )}

          {/* Button Colors Section */}
          <div className="space-y-4">
            <Label className="text-sm font-medium">Personalização dos botões</Label>
            
            {/* WhatsApp button color */}
            {showWhatsApp && (
              <ColorPickerRow
                label="Botão WhatsApp"
                value={supportWidget.whatsappButtonColor ?? supportWidget.buttonColor}
                defaultValue="#25D366"
                onChange={(color) => handleChange('whatsappButtonColor', color)}
                icon={<WhatsAppIconSmall className="h-3 w-3" />}
              />
            )}

            {/* Chat button color */}
            {showChat && (
              <ColorPickerRow
                label="Botão Chat"
                value={supportWidget.chatButtonColor}
                defaultValue="#1F2937"
                onChange={(color) => handleChange('chatButtonColor', color)}
                icon={<MessageCircle className="h-3 w-3" />}
              />
            )}
          </div>

          {/* Button Size */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Tamanho dos botões</Label>
            <div className="flex gap-1 p-1 rounded-lg bg-muted">
              {([
                { value: 'small', label: 'Pequeno' },
                { value: 'medium', label: 'Médio' },
                { value: 'large', label: 'Grande' },
              ] as const).map((opt) => {
                const isActive = (supportWidget.buttonSize ?? 'medium') === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleChange('buttonSize', opt.value)}
                    className={cn(
                      'flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                      isActive
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Altera o tamanho dos botões de WhatsApp e Chat na loja
            </p>
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
