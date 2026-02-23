// =============================================
// NEWSLETTER POPUP BLOCK - Popup email capture form
// Configurable triggers and page visibility
// =============================================

import React, { useState, useEffect } from 'react';
import { X, Mail, Send, Loader2, CheckCircle, User, Phone, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

export interface NewsletterPopupBlockProps {
  // List integration
  listId?: string;
  popupConfigId?: string;
  
  // Content
  title?: string;
  subtitle?: string;
  buttonText?: string;
  successMessage?: string;
  
  // Fields configuration
  showName?: boolean;
  showPhone?: boolean;
  showBirthDate?: boolean;
  nameRequired?: boolean;
  phoneRequired?: boolean;
  birthDateRequired?: boolean;
  
  // Layout
  layout?: 'centered' | 'side-image' | 'corner' | 'fullscreen';
  imageUrl?: string;
  imagePosition?: 'left' | 'right';
  
  // Trigger configuration
  triggerType?: 'delay' | 'scroll' | 'exit_intent' | 'immediate';
  triggerDelaySeconds?: number;
  triggerScrollPercent?: number;
  
  // Page visibility (which page types to show on)
  showOnPages?: string[];
  
  // Visual - Mini Banner
  showBanner?: boolean;
  bannerImageUrl?: string; // Mini banner que cobre o topo inteiro (450x80px recomendado)
  
  // Colors
  backgroundColor?: string;
  textColor?: string;
  buttonBgColor?: string;
  buttonTextColor?: string;
  
  // Behavior
  showOncePerSession?: boolean;
  
  // Context
  tenantId?: string;
  currentPageType?: string;
  isEditing?: boolean;
}

const STORAGE_KEY = 'newsletter_popup_shown';

export function NewsletterPopupBlock({
  listId,
  popupConfigId,
  title = 'Não perca nenhuma novidade!',
  subtitle = 'Cadastre-se e receba ofertas exclusivas.',
  buttonText = 'Quero receber!',
  successMessage = 'Pronto! Você está na lista.',
  showName = true,
  showPhone = false,
  showBirthDate = false,
  nameRequired = false,
  phoneRequired = false,
  birthDateRequired = false,
  layout = 'centered',
  imageUrl,
  imagePosition = 'left',
  triggerType = 'delay',
  triggerDelaySeconds = 5,
  triggerScrollPercent = 50,
  showOnPages = ['home', 'category', 'product'],
  showBanner = false,
  bannerImageUrl,
  backgroundColor,
  textColor,
  buttonBgColor,
  buttonTextColor,
  showOncePerSession = true,
  tenantId,
  currentPageType,
  isEditing,
}: NewsletterPopupBlockProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    phone: '',
    birthDate: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  // Check if should show on current page
  const shouldShowOnCurrentPage = !currentPageType || 
    showOnPages.includes(currentPageType) || 
    showOnPages.includes('all');

  // Trigger logic
  useEffect(() => {
    if (isEditing || !shouldShowOnCurrentPage) return;

    // Check session storage
    if (showOncePerSession) {
      const shown = sessionStorage.getItem(STORAGE_KEY);
      if (shown) return;
    }

    let cleanup: (() => void) | undefined;

    if (triggerType === 'immediate') {
      setIsOpen(true);
    } else if (triggerType === 'delay') {
      const timeout = setTimeout(() => {
        setIsOpen(true);
      }, (triggerDelaySeconds || 5) * 1000);
      cleanup = () => clearTimeout(timeout);
    } else if (triggerType === 'scroll') {
      const handleScroll = () => {
        const scrollPercent = (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100;
        if (scrollPercent >= (triggerScrollPercent || 50)) {
          setIsOpen(true);
          window.removeEventListener('scroll', handleScroll);
        }
      };
      window.addEventListener('scroll', handleScroll);
      cleanup = () => window.removeEventListener('scroll', handleScroll);
    } else if (triggerType === 'exit_intent') {
      const handleMouseLeave = (e: MouseEvent) => {
        if (e.clientY <= 0) {
          setIsOpen(true);
          document.removeEventListener('mouseleave', handleMouseLeave);
        }
      };
      document.addEventListener('mouseleave', handleMouseLeave);
      cleanup = () => document.removeEventListener('mouseleave', handleMouseLeave);
    }

    return cleanup;
  }, [isEditing, shouldShowOnCurrentPage, triggerType, triggerDelaySeconds, triggerScrollPercent, showOncePerSession]);

  const handleClose = () => {
    setIsOpen(false);
    if (showOncePerSession) {
      sessionStorage.setItem(STORAGE_KEY, 'true');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditing) return;
    
    // Validation
    if (!formData.email || !formData.email.includes('@')) {
      setError('Por favor, insira um e-mail válido');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const { data, error: fnError } = await supabase.functions.invoke('marketing-form-submit', {
        body: {
          tenant_id: tenantId,
          form_slug: `popup-${popupConfigId || 'default'}`,
          list_id: listId,
          fields: {
            email: formData.email.toLowerCase().trim(),
            name: formData.name || undefined,
            phone: formData.phone || undefined,
            birth_date: formData.birthDate || undefined,
          },
          source: 'newsletter_popup',
        },
      });

      if (fnError) throw fnError;
      if (data && !data.success) throw new Error(data.error);

      setIsSuccess(true);
      
      // Close after success
      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (err: any) {
      console.error('Popup submit error:', err);
      setError('Erro ao enviar. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const containerStyle: React.CSSProperties = {
    backgroundColor: backgroundColor || undefined,
    color: textColor || undefined,
  };

  const buttonStyle: React.CSSProperties = {
    backgroundColor: buttonBgColor || undefined,
    color: buttonTextColor || undefined,
  };

  // Edit mode preview
  if (isEditing) {
    return (
      <div className="py-6 px-4">
        <div 
          className="max-w-md mx-auto p-6 rounded-xl border-2 border-dashed bg-muted/30"
        >
          <div className="text-center">
            <div className="p-2 rounded-full bg-primary/10 w-fit mx-auto mb-3">
              <Mail className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-semibold mb-1">Popup de Newsletter</h3>
            <p className="text-sm text-muted-foreground mb-3">
              {!listId ? (
                'Selecione uma lista no painel lateral'
              ) : (
                `Trigger: ${triggerType === 'delay' ? `${triggerDelaySeconds}s` : triggerType}`
              )}
            </p>
            
            {listId && (
              <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
                Exibir em: {showOnPages.join(', ')}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Corner layout (mini popup)
  if (layout === 'corner') {
    if (!isOpen) return null;
    
    return (
      <div 
        className="fixed bottom-4 right-4 z-50 w-80 p-4 rounded-xl shadow-2xl border bg-card animate-in slide-in-from-bottom-5"
        style={containerStyle}
      >
        <button 
          onClick={handleClose}
          className="absolute top-2 right-2 p-1 rounded-full hover:bg-muted"
        >
          <X className="w-4 h-4" />
        </button>

        {isSuccess ? (
          <div className="text-center py-4">
            <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2" />
            <p className="font-medium">{successMessage}</p>
          </div>
        ) : (
          <>
            <div className="mb-3 text-center">
              {showBanner && bannerImageUrl && (
                <div className="w-full mb-3 -mx-2 -mt-2">
                  <img 
                    src={bannerImageUrl} 
                    alt="" 
                    className="w-full h-auto object-cover rounded-t-lg"
                    style={{ maxHeight: '105px' }}
                  />
                </div>
              )}
              <h4 className="font-semibold text-center">{title}</h4>
              {subtitle && <p className="text-sm text-muted-foreground text-center">{subtitle}</p>}
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-2">
              {showName && (
                <Input
                  placeholder="Seu nome"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required={nameRequired}
                />
              )}
              <Input
                type="email"
                placeholder="Seu e-mail"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                required
              />
              {error && <p className="text-destructive text-xs">{error}</p>}
              <Button className="w-full" disabled={isLoading} style={buttonStyle}>
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : buttonText}
              </Button>
            </form>
          </>
        )}
      </div>
    );
  }

  // Dialog layouts (centered, side-image, fullscreen)
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent 
        className={cn(
          "sm:max-w-md max-w-[92vw] rounded-xl [&>button.absolute]:hidden",
          layout === 'fullscreen' && "sm:max-w-3xl",
          layout === 'side-image' && imageUrl && "sm:max-w-2xl p-0 overflow-hidden"
        )}
        style={containerStyle}
      >
        {/* Custom close button with theme colors */}
        <button
          onClick={handleClose}
          className="absolute right-3 top-3 z-10 flex items-center justify-center w-8 h-8 rounded-full shadow-md transition-opacity hover:opacity-90"
          style={{
            backgroundColor: buttonBgColor || 'hsl(var(--primary))',
            color: buttonTextColor || 'hsl(var(--primary-foreground))',
          }}
          aria-label="Fechar"
        >
          <X className="w-4 h-4" />
        </button>

        {layout === 'side-image' && imageUrl ? (
          <div className={cn(
            "flex",
            imagePosition === 'right' && "flex-row-reverse"
          )}>
            <div className="w-1/2 hidden sm:block">
              <img 
                src={imageUrl} 
                alt="" 
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1 p-6">
              {renderContent()}
            </div>
          </div>
        ) : (
          <div className="p-2">
            {renderContent()}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );

  function renderContent() {
    if (isSuccess) {
      return (
        <div className="text-center py-8">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold mb-2">Feito!</h3>
          <p className="text-muted-foreground">{successMessage}</p>
        </div>
      );
    }

    return (
      <>
        {/* Banner no topo */}
        {showBanner && bannerImageUrl && (
          <div className="w-full -mt-6 -mx-6 mb-4" style={{ width: 'calc(100% + 48px)' }}>
            <img 
              src={bannerImageUrl} 
              alt="" 
              className="w-full h-auto object-cover"
              style={{ maxHeight: '105px' }}
            />
          </div>
        )}
        
        <DialogHeader className="text-center">
          <DialogTitle className="text-2xl text-center">{title}</DialogTitle>
          {subtitle && (
            <p className="text-muted-foreground mt-2 text-center">{subtitle}</p>
          )}
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {showName && (
            <div className="space-y-1">
              <Label className="flex items-center gap-2">
                <User className="w-4 h-4" />
                Nome {nameRequired && <span className="text-destructive">*</span>}
              </Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                required={nameRequired}
              />
            </div>
          )}

          <div className="space-y-1">
            <Label className="flex items-center gap-2">
              <Mail className="w-4 h-4" />
              E-mail <span className="text-destructive">*</span>
            </Label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              required
            />
          </div>

          {showPhone && (
            <div className="space-y-1">
              <Label className="flex items-center gap-2">
                <Phone className="w-4 h-4" />
                Telefone {phoneRequired && <span className="text-destructive">*</span>}
              </Label>
              <Input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                required={phoneRequired}
              />
            </div>
          )}

          {showBirthDate && (
            <div className="space-y-1">
              <Label className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Data de Nascimento {birthDateRequired && <span className="text-destructive">*</span>}
              </Label>
              <Input
                type="date"
                value={formData.birthDate}
                onChange={(e) => setFormData(prev => ({ ...prev, birthDate: e.target.value }))}
                required={birthDateRequired}
              />
            </div>
          )}

          {error && <p className="text-destructive text-sm">{error}</p>}

          <Button className="w-full" size="lg" disabled={isLoading} style={buttonStyle}>
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Send className="w-4 h-4 mr-2" />
            )}
            {buttonText}
          </Button>
        </form>

        <p className="text-xs text-muted-foreground text-center mt-4">
          Ao se inscrever, você concorda com nossa política de privacidade.
        </p>
      </>
    );
  }
}
