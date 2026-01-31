// =============================================
// FOOTER SETTINGS - Global footer configuration
// Uses centralized useThemeSettings hook (template-wide)
// =============================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Palette, ChevronDown, Settings, Type, Loader2, CreditCard, Store, Plus, Trash2, Mail, Navigation, ShieldCheck } from 'lucide-react';
import { useThemeFooter, DEFAULT_THEME_FOOTER, ThemeFooterConfig, FooterImageItem, FooterImageSectionData, MenuVisualStyle } from '@/hooks/useThemeSettings';
import { ImageUploader } from '../ImageUploader';
import type { SvgPresetCategory } from '@/lib/builder/svg-presets';
import { PaymentIconsQuickSelect } from './PaymentIconsQuickSelect';
import { EmailListSelector } from '../DynamicSelectors';

interface FooterSettingsProps {
  tenantId: string;
  templateSetId?: string;
}

// Color input component - instant preview with auto-save
function ColorInput({ 
  value, 
  onChange, 
  label, 
  placeholder = 'Padrão do tema' 
}: { 
  value: string; 
  onChange: (v: string) => void; 
  label: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px]">{label}</Label>
      <div className="flex gap-1.5">
        <input
          type="color"
          value={value || '#000000'}
          onChange={(e) => onChange(e.target.value)}
          className="w-7 h-7 rounded border cursor-pointer"
        />
        <Input
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 h-7 text-xs"
        />
        {value && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange('')}
            className="h-7 px-1.5 text-xs"
          >
            ✕
          </Button>
        )}
      </div>
    </div>
  );
}

// Footer Image Section component for payment methods and official stores
function FooterImageSection({
  title,
  icon,
  sectionKey,
  localProps,
  updateSection,
  openSections,
  toggleSection,
  requireLink = false,
  svgPresetCategory,
  showQuickSelect = false,
}: {
  title: string;
  icon: React.ReactNode;
  sectionKey: 'paymentMethods' | 'securitySeals' | 'shippingMethods' | 'officialStores';
  localProps: ThemeFooterConfig;
  updateSection: (key: string, value: FooterImageSectionData) => void;
  openSections: Record<string, boolean>;
  toggleSection: (key: string) => void;
  requireLink?: boolean;
  svgPresetCategory?: SvgPresetCategory;
  showQuickSelect?: boolean;
}) {
  const sectionData = (localProps[sectionKey] as FooterImageSectionData) || { title, items: [] };
  const items = sectionData.items || [];
  const [openItems, setOpenItems] = useState<Record<number, boolean>>({});

  const toggleItem = (index: number) => {
    setOpenItems(prev => ({ ...prev, [index]: !prev[index] }));
  };

  const handleUpdateSection = (newData: Partial<FooterImageSectionData>) => {
    updateSection(sectionKey, { ...sectionData, ...newData });
  };

  const addItem = () => {
    const newIndex = items.length;
    handleUpdateSection({ items: [...items, { imageUrl: '', linkUrl: '' }] });
    setOpenItems(prev => ({ ...prev, [newIndex]: true }));
  };

  const addMultipleItems = (newItems: { imageUrl: string; linkUrl: string }[]) => {
    handleUpdateSection({ items: [...items, ...newItems] });
  };

  const removeItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    handleUpdateSection({ items: newItems });
    const newOpenItems = { ...openItems };
    delete newOpenItems[index];
    setOpenItems(newOpenItems);
  };

  const updateItem = (index: number, field: keyof FooterImageItem, value: string) => {
    const newItems = items.map((item, i) => 
      i === index ? { ...item, [field]: value } : item
    );
    handleUpdateSection({ items: newItems });
  };

  const getItemPreview = (item: FooterImageItem) => {
    if (item.imageUrl) {
      if (item.imageUrl.startsWith('data:image/svg')) return 'SVG';
      const filename = item.imageUrl.split('/').pop()?.split('?')[0];
      return filename && filename.length > 20 ? filename.substring(0, 17) + '...' : filename || 'Imagem';
    }
    return 'Sem imagem';
  };

  return (
    <Collapsible open={openSections[sectionKey]} onOpenChange={() => toggleSection(sectionKey)}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="w-full justify-between p-2 h-auto text-xs">
          <div className="flex items-center gap-1.5">
            {icon}
            <span className="font-medium">{title}</span>
            {items.length > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1 py-0">{items.length}</Badge>
            )}
          </div>
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${openSections[sectionKey] ? 'rotate-180' : ''}`} />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-2 pb-3 space-y-3">
        <div className="space-y-1">
          <Label className="text-[10px]">Título da Seção</Label>
          <Input
            value={sectionData.title || ''}
            onChange={(e) => handleUpdateSection({ title: e.target.value })}
            placeholder={title}
            className="h-7 text-xs"
          />
        </div>

        {items.length > 0 && (
          <div className="space-y-2">
            {items.map((item, index) => (
              <Collapsible 
                key={index} 
                open={openItems[index]} 
                onOpenChange={() => toggleItem(index)}
              >
                <div className="border rounded-lg bg-muted/30 overflow-hidden">
                  <div className="flex items-center justify-between p-2 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => toggleItem(index)}>
                    <div className="flex items-center gap-2">
                      <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${openItems[index] ? 'rotate-180' : ''}`} />
                      <span className="text-[10px] font-medium">Item {index + 1}</span>
                      {item.imageUrl && (
                        <span className="text-[10px] text-muted-foreground">• {getItemPreview(item)}</span>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeItem(index);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  <CollapsibleContent>
                    <div className="px-2 pb-2 pt-1 space-y-2 border-t">
                      <div className="space-y-1">
                        <Label className="text-[10px]">Imagem</Label>
                        <ImageUploader
                          value={item.imageUrl}
                          onChange={(url) => updateItem(index, 'imageUrl', url)}
                          placeholder="Upload ou cole URL"
                          svgPresetCategory={svgPresetCategory}
                          aspectRatio="square"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[10px]">
                          Link {requireLink ? '' : '(opcional)'}
                        </Label>
                        <Input
                          value={item.linkUrl || ''}
                          onChange={(e) => updateItem(index, 'linkUrl', e.target.value)}
                          placeholder="https://..."
                          className="h-7 text-xs"
                        />
                      </div>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            ))}
          </div>
        )}

        {/* Quick select for payment icons */}
        {showQuickSelect && (
          <PaymentIconsQuickSelect 
            onAddIcons={addMultipleItems}
            existingUrls={items.map(i => i.imageUrl)}
          />
        )}

        <Button
          variant="outline"
          size="sm"
          className="w-full gap-1.5 h-7 text-xs"
          onClick={addItem}
        >
          <Plus className="h-3 w-3" />
          Adicionar Manualmente
        </Button>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function FooterSettings({ tenantId, templateSetId }: FooterSettingsProps) {
  const { footer: savedFooter, updateFooter, isLoading, isSaving } = useThemeFooter(tenantId, templateSetId);
  const [localProps, setLocalProps] = useState<ThemeFooterConfig>(DEFAULT_THEME_FOOTER);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    colors: true,
    general: false,
    visualMenus: false,
    texts: false,
    paymentMethods: false,
    officialStores: false,
    newsletter: false,
  });
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initialLoadDone = useRef(false);

  // Initialize local state from hook data
  useEffect(() => {
    if (savedFooter && !initialLoadDone.current) {
      setLocalProps(savedFooter);
      initialLoadDone.current = true;
    }
  }, [savedFooter]);

  // Debounced save for text inputs
  const debouncedSave = useCallback((updates: Partial<ThemeFooterConfig>) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      updateFooter(updates);
    }, 400);
  }, [updateFooter]);

  // Update a single prop - immediate UI, debounced save
  const updateProp = useCallback((key: keyof ThemeFooterConfig, value: unknown) => {
    setLocalProps(prev => {
      const updated = { ...prev, [key]: value };
      debouncedSave({ [key]: value });
      return updated;
    });
  }, [debouncedSave]);

  // Update prop immediately (for switches)
  const updatePropImmediate = useCallback((key: keyof ThemeFooterConfig, value: unknown) => {
    setLocalProps(prev => {
      const updated = { ...prev, [key]: value };
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      updateFooter({ [key]: value });
      return updated;
    });
  }, [updateFooter]);

  // Update image section
  const updateImageSection = useCallback((key: string, value: FooterImageSectionData) => {
    setLocalProps(prev => {
      const updated = { ...prev, [key]: value };
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      updateFooter({ [key]: value } as Partial<ThemeFooterConfig>);
      return updated;
    });
  }, [updateFooter]);

  const toggleSection = (key: string) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* === CORES DO RODAPÉ === */}
      <Collapsible open={openSections.colors} onOpenChange={() => toggleSection('colors')}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between p-2 h-auto text-xs">
            <div className="flex items-center gap-1.5">
              <Palette className="h-3.5 w-3.5 text-primary" />
              <span className="font-medium">Cores do Rodapé</span>
            </div>
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${openSections.colors ? 'rotate-180' : ''}`} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="px-2 pb-3 space-y-3">
          <ColorInput
            label="Cor de Fundo"
            value={localProps.footerBgColor || ''}
            onChange={(v) => updateProp('footerBgColor', v)}
          />
          <ColorInput
            label="Cor do Texto"
            value={localProps.footerTextColor || ''}
            onChange={(v) => updateProp('footerTextColor', v)}
          />
          <ColorInput
            label="Cor dos Títulos"
            value={localProps.footerTitlesColor || ''}
            onChange={(v) => updateProp('footerTitlesColor', v)}
            placeholder="Padrão: mesma cor do texto"
          />
        </CollapsibleContent>
      </Collapsible>

      <Separator />

      {/* === SEÇÕES DO RODAPÉ === */}
      <Collapsible open={openSections.general} onOpenChange={() => toggleSection('general')}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between p-2 h-auto text-xs">
            <div className="flex items-center gap-1.5">
              <Settings className="h-3.5 w-3.5 text-primary" />
              <span className="font-medium">Seções do Rodapé</span>
            </div>
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${openSections.general ? 'rotate-180' : ''}`} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="px-2 pb-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="space-y-0">
              <Label className="text-[11px]">Mostrar Logo</Label>
              <p className="text-[10px] text-muted-foreground">Exibe logo no rodapé</p>
            </div>
            <Switch className="scale-90"
              checked={Boolean(localProps.showLogo ?? true)}
              onCheckedChange={(v) => updatePropImmediate('showLogo', v)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0">
              <Label className="text-[11px]">Mostrar Informações da Loja</Label>
              <p className="text-[10px] text-muted-foreground">Exibe nome, CNPJ e descrição</p>
            </div>
            <Switch className="scale-90"
              checked={Boolean(localProps.showStoreInfo ?? true)}
              onCheckedChange={(v) => updatePropImmediate('showStoreInfo', v)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0">
              <Label className="text-[11px]">Mostrar Atendimento (SAC)</Label>
              <p className="text-[10px] text-muted-foreground">Exibe seção de contato</p>
            </div>
            <Switch className="scale-90"
              checked={Boolean(localProps.showSac ?? true)}
              onCheckedChange={(v) => updatePropImmediate('showSac', v)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0">
              <Label className="text-[11px]">Mostrar Redes Sociais</Label>
              <p className="text-[10px] text-muted-foreground">Exibe links das redes sociais</p>
            </div>
            <Switch className="scale-90"
              checked={Boolean(localProps.showSocial ?? true)}
              onCheckedChange={(v) => updatePropImmediate('showSocial', v)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0">
              <Label className="text-[11px]">Mostrar Copyright</Label>
              <p className="text-[10px] text-muted-foreground">Exibe texto de direitos autorais</p>
            </div>
            <Switch className="scale-90"
              checked={Boolean(localProps.showCopyright ?? true)}
              onCheckedChange={(v) => updatePropImmediate('showCopyright', v)}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>

      <Separator />

      {/* === VISUAL MENUS === */}
      <Collapsible open={openSections.visualMenus} onOpenChange={() => toggleSection('visualMenus')}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between p-2 h-auto text-xs">
            <div className="flex items-center gap-1.5">
              <Navigation className="h-3.5 w-3.5 text-primary" />
              <span className="font-medium">Visual Menus</span>
            </div>
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${openSections.visualMenus ? 'rotate-180' : ''}`} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="px-2 pb-3 space-y-3">
          <div className="space-y-1">
            <Label className="text-[10px]">Estilo dos Links</Label>
            <Select 
              value={localProps.menuVisualStyle || 'classic'} 
              onValueChange={(v) => updatePropImmediate('menuVisualStyle', v as MenuVisualStyle)}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Selecione o estilo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="classic" className="text-xs">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">Clássico</span>
                    <span className="text-[10px] text-muted-foreground">Links simples com sublinhado no hover</span>
                  </div>
                </SelectItem>
                <SelectItem value="elegant" className="text-xs">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">Elegante</span>
                    <span className="text-[10px] text-muted-foreground">Transição suave com mudança de cor</span>
                  </div>
                </SelectItem>
                <SelectItem value="minimal" className="text-xs">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">Minimalista</span>
                    <span className="text-[10px] text-muted-foreground">Sem sublinhado, apenas opacidade</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground">
              Define a aparência dos links de navegação no footer
            </p>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <Separator />

      {/* === FORMAS DE PAGAMENTO === */}
      <FooterImageSection
        title="Formas de Pagamento"
        icon={<CreditCard className="h-3.5 w-3.5 text-primary" />}
        sectionKey="paymentMethods"
        localProps={localProps}
        updateSection={updateImageSection}
        openSections={openSections}
        toggleSection={toggleSection}
        svgPresetCategory="payment"
        showQuickSelect={true}
      />

      <Separator />

      {/* === SELOS DE SEGURANÇA === */}
      <FooterImageSection
        title="Selos de Segurança"
        icon={<ShieldCheck className="h-3.5 w-3.5 text-primary" />}
        sectionKey="securitySeals"
        localProps={localProps}
        updateSection={updateImageSection}
        openSections={openSections}
        toggleSection={toggleSection}
        svgPresetCategory="security"
      />

      <Separator />

      {/* === LOJAS OFICIAIS === */}
      <FooterImageSection
        title="Lojas Oficiais"
        icon={<Store className="h-3.5 w-3.5 text-primary" />}
        sectionKey="officialStores"
        localProps={localProps}
        updateSection={updateImageSection}
        openSections={openSections}
        toggleSection={toggleSection}
        requireLink={true}
        svgPresetCategory="store"
      />

      <Separator />

      {/* === NEWSLETTER DO RODAPÉ === */}
      <Collapsible open={openSections.newsletter} onOpenChange={() => toggleSection('newsletter')}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between p-2 h-auto text-xs">
            <div className="flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-primary" />
              <span className="font-medium">Newsletter</span>
              {localProps.showNewsletter && (
                <Badge variant="secondary" className="text-[10px] px-1 py-0">Ativo</Badge>
              )}
            </div>
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${openSections.newsletter ? 'rotate-180' : ''}`} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="px-2 pb-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0">
              <Label className="text-[11px]">Exibir Newsletter</Label>
              <p className="text-[10px] text-muted-foreground">Formulário de captura no rodapé</p>
            </div>
            <Switch className="scale-90"
              checked={Boolean(localProps.showNewsletter ?? false)}
              onCheckedChange={(v) => updatePropImmediate('showNewsletter', v)}
            />
          </div>
          
          {localProps.showNewsletter && (
            <>
              <div className="space-y-1">
                <Label className="text-[10px]">Lista de Destino *</Label>
                <EmailListSelector
                  value={localProps.newsletterListId || ''}
                  onChange={(v) => updateProp('newsletterListId', v)}
                  placeholder="Selecione uma lista"
                />
                <p className="text-[10px] text-muted-foreground">Para qual lista os leads serão enviados</p>
              </div>
              
              <div className="space-y-1">
                <Label className="text-[10px]">Título</Label>
                <Input
                  value={localProps.newsletterTitle || ''}
                  onChange={(e) => updateProp('newsletterTitle', e.target.value)}
                  placeholder="Receba nossas promoções"
                  className="h-7 text-xs"
                />
              </div>
              
              <div className="space-y-1">
                <Label className="text-[10px]">Subtítulo</Label>
                <Input
                  value={localProps.newsletterSubtitle || ''}
                  onChange={(e) => updateProp('newsletterSubtitle', e.target.value)}
                  placeholder="Inscreva-se para receber descontos..."
                  className="h-7 text-xs"
                />
              </div>
              
              <div className="space-y-1">
                <Label className="text-[10px]">Placeholder do campo</Label>
                <Input
                  value={localProps.newsletterPlaceholder || ''}
                  onChange={(e) => updateProp('newsletterPlaceholder', e.target.value)}
                  placeholder="Seu e-mail"
                  className="h-7 text-xs"
                />
              </div>
              
              <div className="space-y-1">
                <Label className="text-[10px]">Texto do botão</Label>
                <Input
                  value={localProps.newsletterButtonText || ''}
                  onChange={(e) => updateProp('newsletterButtonText', e.target.value)}
                  placeholder="Vazio = mostra ícone"
                  className="h-7 text-xs"
                />
                <p className="text-[10px] text-muted-foreground">Deixe vazio para mostrar apenas o ícone de envio</p>
              </div>
              
              <div className="space-y-1">
                <Label className="text-[10px]">Mensagem de sucesso</Label>
                <Input
                  value={localProps.newsletterSuccessMessage || ''}
                  onChange={(e) => updateProp('newsletterSuccessMessage', e.target.value)}
                  placeholder="Inscrito com sucesso!"
                  className="h-7 text-xs"
                />
              </div>
            </>
          )}
        </CollapsibleContent>
      </Collapsible>

      <Separator />
      <Collapsible open={openSections.texts} onOpenChange={() => toggleSection('texts')}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between p-2 h-auto text-xs">
            <div className="flex items-center gap-1.5">
              <Type className="h-3.5 w-3.5 text-primary" />
              <span className="font-medium">Personalizar Títulos Rodapé</span>
            </div>
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${openSections.texts ? 'rotate-180' : ''}`} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="px-2 pb-3 space-y-2.5">
          <div className="space-y-1">
            <Label className="text-[10px]">Título Atendimento</Label>
            <Input
              value={localProps.sacTitle || ''}
              onChange={(e) => updateProp('sacTitle', e.target.value)}
              placeholder="Atendimento (SAC)"
              className="h-7 text-xs"
            />
            <p className="text-[10px] text-muted-foreground">Deixe vazio para usar o padrão</p>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px]">Título Footer 1</Label>
            <Input
              value={localProps.footer1Title || ''}
              onChange={(e) => updateProp('footer1Title', e.target.value)}
              placeholder="Categorias"
              className="h-7 text-xs"
            />
            <p className="text-[10px] text-muted-foreground">Primeira coluna de links</p>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px]">Título Footer 2</Label>
            <Input
              value={localProps.footer2Title || ''}
              onChange={(e) => updateProp('footer2Title', e.target.value)}
              placeholder="Institucional"
              className="h-7 text-xs"
            />
            <p className="text-[10px] text-muted-foreground">Segunda coluna de links</p>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px]">Texto do Copyright</Label>
            <textarea
              value={localProps.copyrightText || ''}
              onChange={(e) => updateProp('copyrightText', e.target.value)}
              placeholder="© {ano} {nome da loja}. Todos os direitos reservados. CNPJ: ..."
              className="w-full h-16 px-2 py-1 text-xs rounded-md border border-input bg-background resize-none"
            />
            <p className="text-[10px] text-muted-foreground">Deixe vazio para usar o padrão automático</p>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <p className="text-xs text-muted-foreground text-center pt-2">
        {isSaving ? '💾 Salvando...' : '✓ Configurações salvas automaticamente neste template'}
      </p>
    </div>
  );
}
