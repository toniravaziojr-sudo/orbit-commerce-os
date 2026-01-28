// =============================================
// POPUP PREVIEW - Live preview of newsletter popup settings
// =============================================

import { X, Mail, ArrowRight, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PopupConfig {
  layout?: string;
  title?: string;
  subtitle?: string | null;
  button_text?: string | null;
  success_message?: string | null;
  background_color?: string | null;
  text_color?: string | null;
  button_bg_color?: string | null;
  button_text_color?: string | null;
  image_url?: string | null;
  show_name?: boolean;
  show_phone?: boolean;
  show_birth_date?: boolean;
}

interface PopupPreviewProps {
  config: PopupConfig;
  isOpen: boolean;
  onClose: () => void;
}

export function PopupPreview({ config, isOpen, onClose }: PopupPreviewProps) {
  if (!isOpen) return null;

  const bgColor = config.background_color || '#ffffff';
  const textColor = config.text_color || '#000000';
  // Use theme variable with neutral fallback (not blue)
  const btnBgColor = config.button_bg_color || 'var(--theme-button-primary-bg, #1a1a1a)';
  const btnTextColor = config.button_text_color || '#ffffff';
  const layout = config.layout || 'centered';
  const hasImage = config.image_url && layout === 'side-image';

  // Corner layout
  if (layout === 'corner') {
    return (
      <div className="fixed bottom-4 right-4 z-[9999] max-w-sm animate-in slide-in-from-bottom-4 duration-300">
        <div 
          className="relative rounded-2xl shadow-2xl overflow-hidden border border-border"
          style={{ backgroundColor: bgColor }}
        >
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 rounded-full bg-black/10 hover:bg-black/20 transition-colors z-10"
          >
            <X className="w-4 h-4" style={{ color: textColor }} />
          </button>

          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div 
                className="p-2.5 rounded-xl"
                style={{ backgroundColor: `${btnBgColor}20` }}
              >
                <Mail className="w-5 h-5" style={{ color: btnBgColor }} />
              </div>
              <h3 className="font-bold text-lg" style={{ color: textColor }}>
                {config.title || 'Título do Popup'}
              </h3>
            </div>

            <p className="text-sm mb-4 opacity-80" style={{ color: textColor }}>
              {config.subtitle || 'Subtítulo do popup'}
            </p>

            <div className="space-y-3">
              {config.show_name && (
                <input
                  type="text"
                  placeholder="Seu nome"
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-white/50 text-sm"
                  style={{ color: textColor }}
                  disabled
                />
              )}
              <input
                type="email"
                placeholder="Seu melhor e-mail"
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-white/50 text-sm"
                style={{ color: textColor }}
                disabled
              />
              {config.show_phone && (
                <input
                  type="tel"
                  placeholder="Seu telefone"
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-white/50 text-sm"
                  style={{ color: textColor }}
                  disabled
                />
              )}
              <button
                className="w-full py-2.5 px-4 rounded-lg font-semibold flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
                style={{ backgroundColor: btnBgColor, color: btnTextColor }}
              >
                {config.button_text || 'Inscrever'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
        
        <p className="text-xs text-muted-foreground mt-2 text-center">
          📍 Preview - Canto da Tela
        </p>
      </div>
    );
  }

  // Centered, Side-Image, Fullscreen layouts
  return (
    <div className={cn(
      'fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200',
      layout === 'fullscreen' ? 'bg-background' : 'bg-black/60 backdrop-blur-sm'
    )}>
      <div
        className={cn(
          'relative rounded-2xl shadow-2xl overflow-hidden border border-border animate-in zoom-in-95 duration-200',
          layout === 'fullscreen' ? 'w-full max-w-4xl' : 'max-w-lg w-full',
          hasImage && 'flex max-w-2xl'
        )}
        style={{ backgroundColor: bgColor }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-black/10 hover:bg-black/20 transition-colors z-10"
        >
          <X className="w-5 h-5" style={{ color: textColor }} />
        </button>

        {/* Image (side-image layout, left) */}
        {hasImage && (
          <div className="hidden sm:block w-1/2 relative min-h-[300px]">
            <img 
              src={config.image_url!} 
              alt="" 
              className="absolute inset-0 w-full h-full object-cover" 
            />
          </div>
        )}

        {/* Content */}
        <div className={cn('p-8', hasImage && 'sm:w-1/2')}>
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div 
              className="p-4 rounded-2xl border"
              style={{ 
                backgroundColor: `${btnBgColor}15`,
                borderColor: `${btnBgColor}30`
              }}
            >
              <Mail className="w-8 h-8" style={{ color: btnBgColor }} />
            </div>
          </div>

          {/* Title & Subtitle */}
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold mb-2" style={{ color: textColor }}>
              {config.title || 'Título do Popup'}
            </h2>
            <p className="opacity-80" style={{ color: textColor }}>
              {config.subtitle || 'Subtítulo do popup'}
            </p>
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            {config.show_name && (
              <input
                type="text"
                placeholder="Seu nome"
                className="w-full px-4 py-3 rounded-xl border border-border bg-white/50 text-center"
                style={{ color: textColor }}
                disabled
              />
            )}
            <input
              type="email"
              placeholder="Seu melhor e-mail"
              className="w-full px-4 py-3 rounded-xl border border-border bg-white/50 text-center"
              style={{ color: textColor }}
              disabled
            />
            {config.show_phone && (
              <input
                type="tel"
                placeholder="Seu telefone"
                className="w-full px-4 py-3 rounded-xl border border-border bg-white/50 text-center"
                style={{ color: textColor }}
                disabled
              />
            )}
            {config.show_birth_date && (
              <input
                type="text"
                placeholder="Data de nascimento"
                className="w-full px-4 py-3 rounded-xl border border-border bg-white/50 text-center"
                style={{ color: textColor }}
                disabled
              />
            )}
            <button
              className="w-full py-3.5 px-6 rounded-xl font-semibold flex items-center justify-center gap-2 shadow-lg transition-opacity hover:opacity-90"
              style={{ 
                backgroundColor: btnBgColor, 
                color: btnTextColor,
                boxShadow: `0 10px 30px -10px ${btnBgColor}40`
              }}
            >
              {config.button_text || 'Inscrever'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Privacy notice */}
          <p className="text-xs text-center mt-4 opacity-60" style={{ color: textColor }}>
            Ao se cadastrar, você concorda com nossa política de privacidade.
          </p>
        </div>
      </div>

      {/* Preview indicator */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
        <p className="text-sm text-white/80 bg-black/50 px-4 py-2 rounded-full backdrop-blur-sm">
          🎯 Preview do Popup - clique no X para fechar
        </p>
      </div>
    </div>
  );
}
