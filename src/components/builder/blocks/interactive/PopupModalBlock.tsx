// =============================================
// POPUP MODAL BLOCK - Newsletter or promotion popup
// =============================================

import React, { useState, useEffect } from 'react';
import { X, Mail, Gift, Bell, Tag, Sparkles, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PopupModalBlockProps {
  title?: string;
  subtitle?: string;
  type?: 'newsletter' | 'promotion' | 'announcement' | 'exit-intent';
  layout?: 'centered' | 'side-image' | 'fullscreen' | 'corner';
  imageUrl?: string;
  imagePosition?: 'left' | 'right';
  showEmailInput?: boolean;
  emailPlaceholder?: string;
  buttonText?: string;
  buttonUrl?: string;
  discountCode?: string;
  discountLabel?: string;
  trigger?: 'immediate' | 'delay' | 'scroll' | 'exit';
  delay?: number;
  scrollPercentage?: number;
  showCloseButton?: boolean;
  closeable?: boolean;
  isEditing?: boolean;
}

const typeIcons = {
  newsletter: Mail,
  promotion: Tag,
  announcement: Bell,
  'exit-intent': Gift,
};

export function PopupModalBlock({
  title = 'Receba Ofertas Exclusivas!',
  subtitle = 'Cadastre-se e ganhe 10% de desconto na primeira compra',
  type = 'newsletter',
  layout = 'centered',
  imageUrl = 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=500&h=600&fit=crop',
  imagePosition = 'left',
  showEmailInput = true,
  emailPlaceholder = 'Seu melhor e-mail',
  buttonText = 'Quero meu desconto!',
  buttonUrl,
  discountCode = 'BEMVINDO10',
  discountLabel = 'Use o cupom:',
  trigger = 'immediate',
  delay = 3000,
  scrollPercentage = 50,
  showCloseButton = true,
  closeable = true,
  isEditing = false,
}: PopupModalBlockProps) {
  const [isOpen, setIsOpen] = useState(isEditing);
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Trigger logic (apenas em produção)
  useEffect(() => {
    if (isEditing) {
      setIsOpen(true);
      return;
    }

    // Simular triggers
    if (trigger === 'immediate') {
      setIsOpen(true);
    } else if (trigger === 'delay') {
      const timer = setTimeout(() => setIsOpen(true), delay);
      return () => clearTimeout(timer);
    }
    // scroll e exit-intent seriam implementados com listeners reais em produção
  }, [trigger, delay, isEditing]);

  const handleClose = () => {
    if (closeable || isEditing) {
      setIsOpen(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setIsSubmitted(true);
    }
  };

  const Icon = typeIcons[type];

  if (!isOpen && !isEditing) return null;

  // Layout: Corner (canto inferior)
  if (layout === 'corner') {
    return (
      <div className="fixed bottom-4 right-4 z-50 max-w-sm">
        <div className="relative bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
          {showCloseButton && (
            <button
              onClick={handleClose}
              className="absolute top-3 right-3 p-1.5 rounded-full bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors z-10"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-primary/10">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-bold text-lg text-foreground">{title}</h3>
            </div>

            <p className="text-sm text-muted-foreground mb-4">{subtitle}</p>

            {!isSubmitted ? (
              <form onSubmit={handleSubmit} className="space-y-3">
                {showEmailInput && (
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={emailPlaceholder}
                    className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                )}
                <button
                  type="submit"
                  className="w-full py-2.5 px-4 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                >
                  {buttonText}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            ) : (
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-3">
                  <Sparkles className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <p className="font-medium text-foreground mb-1">Pronto!</p>
                {discountCode && (
                  <div className="mt-3 p-3 rounded-lg bg-muted">
                    <p className="text-xs text-muted-foreground mb-1">{discountLabel}</p>
                    <p className="font-mono font-bold text-lg text-primary">{discountCode}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        
        {isEditing && (
          <p className="text-xs text-muted-foreground mt-2 text-center">
            📍 Preview do popup (canto)
          </p>
        )}
      </div>
    );
  }

  // Layout: Side Image e Centered
  const hasImage = imageUrl && layout === 'side-image';

  return (
    <div className={cn(
      'fixed inset-0 z-50 flex items-center justify-center p-4',
      layout === 'fullscreen' ? 'bg-background' : 'bg-black/60 backdrop-blur-sm'
    )}>
      <div
        className={cn(
          'relative bg-card border border-border rounded-2xl shadow-2xl overflow-hidden',
          layout === 'fullscreen' ? 'w-full max-w-4xl' : 'max-w-lg w-full',
          hasImage && 'flex max-w-2xl'
        )}
      >
        {/* Close button */}
        {showCloseButton && (
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors z-10"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Image (side-image layout) */}
        {hasImage && imagePosition === 'left' && (
          <div className="hidden sm:block w-1/2 relative">
            <img src={imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent to-card/10" />
          </div>
        )}

        {/* Content */}
        <div className={cn('p-8', hasImage && 'sm:w-1/2')}>
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20">
              <Icon className="w-8 h-8 text-primary" />
            </div>
          </div>

          {/* Title & Subtitle */}
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-foreground mb-2">{title}</h2>
            <p className="text-muted-foreground">{subtitle}</p>
          </div>

          {!isSubmitted ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              {showEmailInput && (
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={emailPlaceholder}
                  className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-center"
                />
              )}
              <button
                type="submit"
                className="w-full py-3.5 px-6 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-primary/25"
              >
                {buttonText}
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          ) : (
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <p className="font-semibold text-foreground text-lg mb-1">Cadastro realizado!</p>
              <p className="text-sm text-muted-foreground mb-4">Confira seu e-mail para mais detalhes</p>
              
              {discountCode && (
                <div className="mt-4 p-4 rounded-xl bg-muted border border-border">
                  <p className="text-sm text-muted-foreground mb-2">{discountLabel}</p>
                  <div className="flex items-center justify-center gap-2">
                    <span className="font-mono font-bold text-2xl text-primary tracking-wider">
                      {discountCode}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Privacy notice */}
          <p className="text-xs text-muted-foreground text-center mt-4">
            Ao se cadastrar, você concorda com nossa política de privacidade.
          </p>
        </div>

        {/* Image (side-image layout, right) */}
        {hasImage && imagePosition === 'right' && (
          <div className="hidden sm:block w-1/2 relative">
            <img src={imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-l from-transparent to-card/10" />
          </div>
        )}
      </div>

      {isEditing && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
          <p className="text-sm text-white/80 bg-black/50 px-4 py-2 rounded-full backdrop-blur-sm">
            🎯 Preview do popup - clique no X para fechar
          </p>
        </div>
      )}
    </div>
  );
}
