// =============================================
// POPUP SETTINGS - Newsletter popup configuration
// Settings moved from builder blocks to theme settings
// Uses newsletter_popup_configs table
// =============================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Loader2, ChevronRight, Mail, Eye, Palette, Settings2, Image as ImageIcon, Bell, Play, Trash2 } from 'lucide-react';
import { ImageUploaderWithLibrary } from '@/components/builder/ImageUploaderWithLibrary';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { PopupPreview } from './PopupPreview';

interface PopupSettingsProps {
  tenantId: string;
  templateSetId?: string;
}

interface PopupConfig {
  id: string;
  name: string;
  list_id: string | null;
  layout: string;
  title: string;
  subtitle: string | null;
  success_message: string | null;
  button_text: string | null;
  show_name: boolean;
  show_phone: boolean;
  show_birth_date: boolean;
  name_required: boolean;
  phone_required: boolean;
  birth_date_required: boolean;
  background_color: string | null;
  text_color: string | null;
  button_bg_color: string | null;
  button_text_color: string | null;
  image_url: string | null;
  icon_image_url: string | null;
  trigger_type: string;
  trigger_delay_seconds: number | null;
  trigger_scroll_percent: number | null;
  show_on_pages: string[] | null;
  exclude_pages: string[] | null;
  is_active: boolean;
  show_once_per_session: boolean;
}

const defaultConfig: Partial<PopupConfig> = {
  name: 'Popup Principal',
  layout: 'centered',
  title: 'Inscreva-se na nossa newsletter',
  subtitle: 'Receba ofertas exclusivas e novidades!',
  success_message: 'Obrigado por se inscrever!',
  button_text: 'Inscrever',
  show_name: true,
  show_phone: false,
  show_birth_date: false,
  name_required: false,
  phone_required: false,
  birth_date_required: false,
  background_color: '#ffffff',
  text_color: '#000000',
  button_bg_color: '#3b82f6',
  button_text_color: '#ffffff',
  trigger_type: 'delay',
  trigger_delay_seconds: 5,
  trigger_scroll_percent: 50,
  show_on_pages: ['home', 'category', 'product'],
  is_active: false,
  show_once_per_session: true,
};

const layoutOptions = [
  { value: 'centered', label: 'Centralizado' },
  { value: 'side-image', label: 'Com Imagem Lateral' },
  { value: 'corner', label: 'Canto da Tela' },
  { value: 'fullscreen', label: 'Tela Cheia' },
];

const triggerOptions = [
  { value: 'delay', label: 'Após X segundos' },
  { value: 'scroll', label: 'Ao rolar X%' },
  { value: 'exit_intent', label: 'Ao sair da página' },
  { value: 'immediate', label: 'Imediatamente' },
];

const pageOptions = [
  { value: 'home', label: 'Página Inicial' },
  { value: 'category', label: 'Categoria' },
  { value: 'product', label: 'Produto' },
  { value: 'cart', label: 'Carrinho' },
  { value: 'blog', label: 'Blog' },
];

export function PopupSettings({ tenantId, templateSetId }: PopupSettingsProps) {
  const queryClient = useQueryClient();
  const [localConfig, setLocalConfig] = useState<Partial<PopupConfig>>(defaultConfig);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    general: true,
    appearance: false,
    trigger: false,
    fields: false,
  });
  const [showPreview, setShowPreview] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initialLoadDone = useRef(false);

  // Fetch existing popup config
  const { data: popupConfig, isLoading } = useQuery({
    queryKey: ['newsletter-popup-config', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('newsletter_popup_configs')
        .select('*')
        .eq('tenant_id', tenantId)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as PopupConfig | null;
    },
    enabled: !!tenantId,
  });

  // Fetch email marketing lists for dropdown
  const { data: lists = [] } = useQuery({
    queryKey: ['email-marketing-lists-for-popup', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_marketing_lists')
        .select('id, name')
        .eq('tenant_id', tenantId)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  // Initialize local state
  useEffect(() => {
    if (popupConfig && !initialLoadDone.current) {
      setLocalConfig(popupConfig);
      initialLoadDone.current = true;
    } else if (!popupConfig && !initialLoadDone.current) {
      setLocalConfig(defaultConfig);
      initialLoadDone.current = true;
    }
  }, [popupConfig]);

  // Upsert mutation
  const upsertMutation = useMutation({
    mutationFn: async (updates: Partial<PopupConfig>) => {
      const fullConfig = {
        ...localConfig,
        ...updates,
        tenant_id: tenantId,
      };

      if (popupConfig?.id) {
        // Update existing
        const { error } = await supabase
          .from('newsletter_popup_configs')
          .update({
            name: fullConfig.name,
            list_id: fullConfig.list_id,
            layout: fullConfig.layout,
            title: fullConfig.title,
            subtitle: fullConfig.subtitle,
            success_message: fullConfig.success_message,
            button_text: fullConfig.button_text,
            show_name: fullConfig.show_name,
            show_phone: fullConfig.show_phone,
            show_birth_date: fullConfig.show_birth_date,
            name_required: fullConfig.name_required,
            phone_required: fullConfig.phone_required,
            birth_date_required: fullConfig.birth_date_required,
            background_color: fullConfig.background_color,
            text_color: fullConfig.text_color,
            button_bg_color: fullConfig.button_bg_color,
            button_text_color: fullConfig.button_text_color,
            image_url: fullConfig.image_url,
            icon_image_url: fullConfig.icon_image_url,
            trigger_type: fullConfig.trigger_type,
            trigger_delay_seconds: fullConfig.trigger_delay_seconds,
            trigger_scroll_percent: fullConfig.trigger_scroll_percent,
            show_on_pages: fullConfig.show_on_pages,
            exclude_pages: fullConfig.exclude_pages,
            is_active: fullConfig.is_active,
            show_once_per_session: fullConfig.show_once_per_session,
          })
          .eq('id', popupConfig.id);
        if (error) throw error;
      } else {
        // Create new
        const { error } = await supabase
          .from('newsletter_popup_configs')
          .insert({
            tenant_id: tenantId,
            name: fullConfig.name || 'Popup Principal',
            list_id: fullConfig.list_id,
            layout: fullConfig.layout || 'centered',
            title: fullConfig.title || 'Inscreva-se',
            subtitle: fullConfig.subtitle,
            success_message: fullConfig.success_message,
            button_text: fullConfig.button_text,
            show_name: fullConfig.show_name,
            show_phone: fullConfig.show_phone,
            show_birth_date: fullConfig.show_birth_date,
            name_required: fullConfig.name_required,
            phone_required: fullConfig.phone_required,
            birth_date_required: fullConfig.birth_date_required,
            background_color: fullConfig.background_color,
            text_color: fullConfig.text_color,
            button_bg_color: fullConfig.button_bg_color,
            button_text_color: fullConfig.button_text_color,
            image_url: fullConfig.image_url,
            icon_image_url: fullConfig.icon_image_url,
            trigger_type: fullConfig.trigger_type || 'delay',
            trigger_delay_seconds: fullConfig.trigger_delay_seconds,
            trigger_scroll_percent: fullConfig.trigger_scroll_percent,
            show_on_pages: fullConfig.show_on_pages,
            exclude_pages: fullConfig.exclude_pages,
            is_active: fullConfig.is_active,
            show_once_per_session: fullConfig.show_once_per_session,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['newsletter-popup-config', tenantId] });
    },
    onError: (error) => {
      console.error('Error saving popup config:', error);
      toast.error('Erro ao salvar configurações do popup');
    },
  });

  // Debounced save
  const debouncedSave = useCallback((updates: Partial<PopupConfig>) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      upsertMutation.mutate(updates);
    }, 500);
  }, [upsertMutation]);

  const updateProp = useCallback((key: keyof PopupConfig, value: unknown) => {
    setLocalConfig(prev => {
      const updated = { ...prev, [key]: value };
      debouncedSave({ [key]: value });
      return updated;
    });
  }, [debouncedSave]);

  const updatePropImmediate = useCallback((key: keyof PopupConfig, value: unknown) => {
    setLocalConfig(prev => {
      const updated = { ...prev, [key]: value };
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      upsertMutation.mutate({ [key]: value });
      return updated;
    });
  }, [upsertMutation]);

  const toggleSection = (key: string) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handlePagesChange = (pageValue: string, checked: boolean) => {
    const currentPages = localConfig.show_on_pages || [];
    const newPages = checked 
      ? [...currentPages, pageValue]
      : currentPages.filter(p => p !== pageValue);
    updatePropImmediate('show_on_pages', newPages);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Preview Button */}
      <Button
        variant="outline"
        className="w-full gap-2"
        onClick={() => setShowPreview(true)}
      >
        <Play className="h-4 w-4" />
        Visualizar Popup
      </Button>

      {/* Active Toggle - Prominent */}
      <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border">
        <div className="flex items-center gap-3">
          <Bell className="h-5 w-5 text-primary" />
          <div>
            <Label className="text-sm font-medium">Popup Ativo</Label>
            <p className="text-xs text-muted-foreground">Exibir popup para visitantes</p>
          </div>
        </div>
        <Switch
          checked={localConfig.is_active || false}
          onCheckedChange={(v) => updatePropImmediate('is_active', v)}
        />
      </div>

      {/* Popup Preview Modal */}
      <PopupPreview
        config={localConfig}
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
      />

      {/* General Section */}
      <Collapsible open={openSections.general} onOpenChange={() => toggleSection('general')}>
        <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors">
          <div className="flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            <span className="font-medium text-sm">Geral</span>
          </div>
          <ChevronRight className={cn("h-4 w-4 transition-transform", openSections.general && "rotate-90")} />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3 space-y-4">
          {/* List Selection */}
          <div className="space-y-2">
            <Label className="text-sm">Lista de Email</Label>
            <Select
              value={localConfig.list_id || 'none'}
              onValueChange={(v) => updatePropImmediate('list_id', v === 'none' ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma lista" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhuma lista</SelectItem>
                {lists.map((list) => (
                  <SelectItem key={list.id} value={list.id}>{list.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Os leads capturados serão adicionados a esta lista
            </p>
          </div>

          {/* Layout */}
          <div className="space-y-2">
            <Label className="text-sm">Layout</Label>
            <Select
              value={localConfig.layout || 'centered'}
              onValueChange={(v) => updatePropImmediate('layout', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {layoutOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label className="text-sm">Título</Label>
            <Input
              value={localConfig.title || ''}
              onChange={(e) => updateProp('title', e.target.value)}
              placeholder="Inscreva-se..."
            />
          </div>

          {/* Subtitle */}
          <div className="space-y-2">
            <Label className="text-sm">Subtítulo</Label>
            <Textarea
              value={localConfig.subtitle || ''}
              onChange={(e) => updateProp('subtitle', e.target.value)}
              placeholder="Receba ofertas exclusivas..."
              rows={2}
            />
          </div>

          {/* Button Text */}
          <div className="space-y-2">
            <Label className="text-sm">Texto do Botão</Label>
            <Input
              value={localConfig.button_text || ''}
              onChange={(e) => updateProp('button_text', e.target.value)}
              placeholder="Inscrever"
            />
          </div>

          {/* Success Message */}
          <div className="space-y-2">
            <Label className="text-sm">Mensagem de Sucesso</Label>
            <Input
              value={localConfig.success_message || ''}
              onChange={(e) => updateProp('success_message', e.target.value)}
              placeholder="Obrigado por se inscrever!"
            />
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Appearance Section */}
      <Collapsible open={openSections.appearance} onOpenChange={() => toggleSection('appearance')}>
        <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors">
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            <span className="font-medium text-sm">Aparência</span>
          </div>
          <ChevronRight className={cn("h-4 w-4 transition-transform", openSections.appearance && "rotate-90")} />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3 space-y-4">
          {/* Colors */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs">Fundo</Label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={localConfig.background_color || '#ffffff'}
                  onChange={(e) => updateProp('background_color', e.target.value)}
                  className="h-9 w-12 rounded border cursor-pointer"
                />
                <Input
                  value={localConfig.background_color || '#ffffff'}
                  onChange={(e) => updateProp('background_color', e.target.value)}
                  className="flex-1 font-mono text-xs"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Texto</Label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={localConfig.text_color || '#000000'}
                  onChange={(e) => updateProp('text_color', e.target.value)}
                  className="h-9 w-12 rounded border cursor-pointer"
                />
                <Input
                  value={localConfig.text_color || '#000000'}
                  onChange={(e) => updateProp('text_color', e.target.value)}
                  className="flex-1 font-mono text-xs"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Fundo do Botão</Label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={localConfig.button_bg_color || '#3b82f6'}
                  onChange={(e) => updateProp('button_bg_color', e.target.value)}
                  className="h-9 w-12 rounded border cursor-pointer"
                />
                <Input
                  value={localConfig.button_bg_color || '#3b82f6'}
                  onChange={(e) => updateProp('button_bg_color', e.target.value)}
                  className="flex-1 font-mono text-xs"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Texto do Botão</Label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={localConfig.button_text_color || '#ffffff'}
                  onChange={(e) => updateProp('button_text_color', e.target.value)}
                  className="h-9 w-12 rounded border cursor-pointer"
                />
                <Input
                  value={localConfig.button_text_color || '#ffffff'}
                  onChange={(e) => updateProp('button_text_color', e.target.value)}
                  className="flex-1 font-mono text-xs"
                />
              </div>
            </div>
          </div>

          {/* Image URL - with upload support */}
          <div className="space-y-2">
            <Label className="text-sm flex items-center gap-2">
              <ImageIcon className="h-4 w-4" />
              Imagem Lateral
            </Label>
            <ImageUploaderWithLibrary
              value={localConfig.image_url || ''}
              onChange={(url) => updateProp('image_url', url)}
              variant="desktop"
              aspectRatio="square"
              placeholder="Envie ou selecione uma imagem"
            />
            <p className="text-xs text-muted-foreground">Usado no layout "Com Imagem Lateral"</p>
          </div>

          {/* Icon Image URL - with upload support */}
          <div className="space-y-2">
            <Label className="text-sm flex items-center gap-2">
              <ImageIcon className="h-4 w-4" />
              Ícone do Incentivo (Mini Imagem)
            </Label>
            <ImageUploaderWithLibrary
              value={localConfig.icon_image_url || ''}
              onChange={(url) => updateProp('icon_image_url', url)}
              variant="desktop"
              aspectRatio="square"
              placeholder="Envie ou selecione (opcional)"
            />
            <p className="text-xs text-muted-foreground">
              Substitui o emoji 🎁 por uma mini imagem (24x24px) no badge de incentivo
            </p>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Trigger Section */}
      <Collapsible open={openSections.trigger} onOpenChange={() => toggleSection('trigger')}>
        <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            <span className="font-medium text-sm">Quando Exibir</span>
          </div>
          <ChevronRight className={cn("h-4 w-4 transition-transform", openSections.trigger && "rotate-90")} />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3 space-y-4">
          {/* Trigger Type */}
          <div className="space-y-2">
            <Label className="text-sm">Gatilho</Label>
            <Select
              value={localConfig.trigger_type || 'delay'}
              onValueChange={(v) => updatePropImmediate('trigger_type', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {triggerOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Delay Seconds */}
          {localConfig.trigger_type === 'delay' && (
            <div className="space-y-2">
              <Label className="text-sm">Segundos de atraso</Label>
              <Input
                type="number"
                min={1}
                max={60}
                value={localConfig.trigger_delay_seconds || 5}
                onChange={(e) => updateProp('trigger_delay_seconds', parseInt(e.target.value) || 5)}
              />
            </div>
          )}

          {/* Scroll Percent */}
          {localConfig.trigger_type === 'scroll' && (
            <div className="space-y-2">
              <Label className="text-sm">Porcentagem de rolagem</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={localConfig.trigger_scroll_percent || 50}
                onChange={(e) => updateProp('trigger_scroll_percent', parseInt(e.target.value) || 50)}
              />
            </div>
          )}

          {/* Show on Pages */}
          <div className="space-y-2">
            <Label className="text-sm">Exibir nas Páginas</Label>
            <div className="space-y-2">
              {pageOptions.map((page) => (
                <div key={page.value} className="flex items-center gap-2">
                  <Switch
                    checked={(localConfig.show_on_pages || []).includes(page.value)}
                    onCheckedChange={(checked) => handlePagesChange(page.value, checked)}
                    id={`page-${page.value}`}
                  />
                  <Label htmlFor={`page-${page.value}`} className="text-sm font-normal cursor-pointer">
                    {page.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Show Once */}
          <div className="flex items-center justify-between">
            <Label className="text-sm">Exibir apenas 1x por sessão</Label>
            <Switch
              checked={localConfig.show_once_per_session || false}
              onCheckedChange={(v) => updatePropImmediate('show_once_per_session', v)}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Fields Section */}
      <Collapsible open={openSections.fields} onOpenChange={() => toggleSection('fields')}>
        <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            <span className="font-medium text-sm">Campos do Formulário</span>
          </div>
          <ChevronRight className={cn("h-4 w-4 transition-transform", openSections.fields && "rotate-90")} />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3 space-y-4">
          <p className="text-xs text-muted-foreground">Email é sempre obrigatório</p>
          
          {/* Name Field */}
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <Label className="text-sm font-medium">Nome</Label>
              <p className="text-xs text-muted-foreground">Solicitar nome do visitante</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">Exibir</span>
                <Switch
                  checked={localConfig.show_name || false}
                  onCheckedChange={(v) => updatePropImmediate('show_name', v)}
                />
              </div>
              {localConfig.show_name && (
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">Obrigatório</span>
                  <Switch
                    checked={localConfig.name_required || false}
                    onCheckedChange={(v) => updatePropImmediate('name_required', v)}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Phone Field */}
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <Label className="text-sm font-medium">Telefone</Label>
              <p className="text-xs text-muted-foreground">Solicitar telefone</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">Exibir</span>
                <Switch
                  checked={localConfig.show_phone || false}
                  onCheckedChange={(v) => updatePropImmediate('show_phone', v)}
                />
              </div>
              {localConfig.show_phone && (
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">Obrigatório</span>
                  <Switch
                    checked={localConfig.phone_required || false}
                    onCheckedChange={(v) => updatePropImmediate('phone_required', v)}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Birth Date Field */}
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <Label className="text-sm font-medium">Data de Nascimento</Label>
              <p className="text-xs text-muted-foreground">Para ofertas de aniversário</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">Exibir</span>
                <Switch
                  checked={localConfig.show_birth_date || false}
                  onCheckedChange={(v) => updatePropImmediate('show_birth_date', v)}
                />
              </div>
              {localConfig.show_birth_date && (
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">Obrigatório</span>
                  <Switch
                    checked={localConfig.birth_date_required || false}
                    onCheckedChange={(v) => updatePropImmediate('birth_date_required', v)}
                  />
                </div>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Saving indicator */}
      {upsertMutation.isPending && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Salvando...
        </div>
      )}
    </div>
  );
}
