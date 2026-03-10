// =============================================
// SUPPORT SETTINGS - Widget de atendimento configuration
// Configures: enable/disable, type (chat/whatsapp/both), 
// WhatsApp number, default message, button color, position
// =============================================

import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Loader2, MessageCircle, Phone } from 'lucide-react';
import { useThemeSettings, type SupportWidgetConfig, DEFAULT_SUPPORT_WIDGET, type SupportWidgetType, type SupportWidgetPosition } from '@/hooks/useThemeSettings';
import { toast } from 'sonner';

interface SupportSettingsProps {
  tenantId: string;
  templateSetId?: string;
}

export function SupportSettings({ tenantId, templateSetId }: SupportSettingsProps) {
  const { themeSettings, saveThemeSettings, isSaving } = useThemeSettings(tenantId, templateSetId);
  
  const saved = themeSettings?.supportWidget || DEFAULT_SUPPORT_WIDGET;
  
  const [enabled, setEnabled] = useState(saved.enabled ?? true);
  const [type, setType] = useState<SupportWidgetType>(saved.type ?? 'chat');
  const [whatsappNumber, setWhatsappNumber] = useState(saved.whatsappNumber ?? '');
  const [whatsappMessage, setWhatsappMessage] = useState(saved.whatsappMessage ?? 'Olá! Preciso de ajuda.');
  const [buttonColor, setButtonColor] = useState(saved.buttonColor ?? '#25D366');
  const [position, setPosition] = useState<SupportWidgetPosition>(saved.position ?? 'right');

  // Sync from saved when loaded
  useEffect(() => {
    if (themeSettings?.supportWidget) {
      const s = themeSettings.supportWidget;
      setEnabled(s.enabled ?? true);
      setType(s.type ?? 'chat');
      setWhatsappNumber(s.whatsappNumber ?? '');
      setWhatsappMessage(s.whatsappMessage ?? 'Olá! Preciso de ajuda.');
      setButtonColor(s.buttonColor ?? '#25D366');
      setPosition(s.position ?? 'right');
    }
  }, [themeSettings?.supportWidget]);

  const handleSave = async () => {
    const config: SupportWidgetConfig = {
      enabled,
      type,
      whatsappNumber,
      whatsappMessage,
      buttonColor,
      position,
    };
    
    try {
      await saveThemeSettings({ supportWidget: config });
      toast.success('Configurações de atendimento salvas!');
    } catch {
      toast.error('Erro ao salvar configurações');
    }
  };

  const needsWhatsApp = type === 'whatsapp' || type === 'both';

  return (
    <div className="space-y-6">
      {/* Enable/Disable */}
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-medium">Ativar widget</Label>
          <p className="text-xs text-muted-foreground">Exibir botão flutuante de atendimento</p>
        </div>
        <Switch checked={enabled} onCheckedChange={setEnabled} />
      </div>

      {enabled && (
        <>
          {/* Widget Type */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Tipo de atendimento</Label>
            <Select value={type} onValueChange={(v) => setType(v as SupportWidgetType)}>
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
              {type === 'chat' && 'Chat integrado com IA e atendimento humano'}
              {type === 'whatsapp' && 'Botão flutuante que abre o WhatsApp'}
              {type === 'both' && 'Chat interno + botão WhatsApp lado a lado'}
            </p>
          </div>

          {/* WhatsApp Number */}
          {needsWhatsApp && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Número do WhatsApp</Label>
              <Input
                placeholder="+55 11 99999-9999"
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
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
                value={whatsappMessage}
                onChange={(e) => setWhatsappMessage(e.target.value)}
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
                value={buttonColor}
                onChange={(e) => setButtonColor(e.target.value)}
                className="h-9 w-12 rounded border cursor-pointer"
              />
              <Input
                value={buttonColor}
                onChange={(e) => setButtonColor(e.target.value)}
                className="flex-1 font-mono text-xs"
                maxLength={7}
              />
            </div>
          </div>

          {/* Position */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Posição</Label>
            <Select value={position} onValueChange={(v) => setPosition(v as SupportWidgetPosition)}>
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

      {/* Save Button */}
      <Button onClick={handleSave} disabled={isSaving} className="w-full">
        {isSaving ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Salvando...
          </>
        ) : (
          'Salvar'
        )}
      </Button>
    </div>
  );
}
