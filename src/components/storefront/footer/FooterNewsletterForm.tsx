// =============================================
// FOOTER NEWSLETTER FORM - Horizontal newsletter form for footer
// Uses marketing-form-submit edge function for lead capture
// =============================================

import { useState } from 'react';
import { Send, Loader2, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface FooterNewsletterFormProps {
  tenantId?: string;
  title?: string;
  subtitle?: string;
  placeholder?: string;
  buttonText?: string;
  successMessage?: string;
  listId?: string;
  textColor?: string;
  buttonBgColor?: string;
  buttonTextColor?: string;
  isEditing?: boolean;
}

export function FooterNewsletterForm({
  tenantId,
  title = 'Receba nossas promoções',
  subtitle = 'Inscreva-se para receber descontos exclusivos direto no seu e-mail!',
  placeholder = 'Seu e-mail',
  buttonText = '',
  successMessage = 'Inscrito com sucesso!',
  listId,
  textColor,
  buttonBgColor,
  buttonTextColor,
  isEditing = false,
}: FooterNewsletterFormProps) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditing) return;
    
    const trimmedEmail = email.trim().toLowerCase();
    
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setError('Por favor, insira um e-mail válido');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const { data, error: fnError } = await supabase.functions.invoke('marketing-form-submit', {
        body: {
          tenant_id: tenantId,
          list_id: listId || undefined,
          fields: { email: trimmedEmail },
          source: 'footer_newsletter',
        },
      });

      if (fnError || !data?.success) {
        throw new Error(data?.error || fnError?.message || 'Erro ao processar inscrição');
      }

      setIsSuccess(true);
      setEmail('');
      
      // Reset success state after 5 seconds
      setTimeout(() => setIsSuccess(false), 5000);
    } catch (err: unknown) {
      console.error('Newsletter subscription error:', err);
      setError('Erro ao processar. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  // Success state
  if (isSuccess) {
    return (
      <div className="flex flex-col gap-2">
        {title && (
          <h4 
            className="text-sm font-semibold uppercase tracking-wide"
            style={{ color: textColor || undefined }}
          >
            {title}
          </h4>
        )}
        <div 
          className="flex items-center gap-2 text-sm"
          style={{ color: textColor || undefined }}
        >
          <Check className="h-4 w-4 text-green-500" />
          <span>{successMessage}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 w-full">
      {/* Title - only show if provided and not empty */}
      {title && title.trim() !== '' && (
        <h4 
          className="text-sm font-semibold uppercase tracking-wide"
          style={{ color: textColor || undefined }}
        >
          {title}
        </h4>
      )}
      
      {/* Subtitle - only show if provided and not empty */}
      {subtitle && subtitle.trim() !== '' && (
        <p 
          className="text-xs opacity-80"
          style={{ color: textColor || undefined }}
        >
          {subtitle}
        </p>
      )}

      {/* Form - full width horizontal layout */}
      <form onSubmit={handleSubmit} className="flex items-stretch w-full">
        <div className="relative flex-1">
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (error) setError('');
            }}
            placeholder={placeholder}
            disabled={isLoading || isEditing}
            className={cn(
              "w-full h-11 px-4 text-sm rounded-l-md",
              "border border-r-0 bg-white/10 backdrop-blur-sm",
              "placeholder:opacity-60 focus:outline-none focus:ring-2 focus:ring-primary/30",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              error && "border-destructive"
            )}
            style={{ 
              color: textColor || undefined,
              borderColor: textColor ? `${textColor}30` : undefined,
            }}
          />
        </div>
        
        <button
          type="submit"
          disabled={isLoading || isEditing || !email.trim()}
          className={cn(
            "h-11 px-5 rounded-r-md flex items-center justify-center",
            "transition-all duration-200",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "hover:opacity-90 active:scale-[0.98]"
          )}
          style={buttonBgColor ? {
            backgroundColor: buttonBgColor,
            color: buttonTextColor || '#ffffff',
          } : {
            backgroundColor: 'var(--theme-button-primary-bg, #1a1a1a)',
            color: buttonTextColor || 'var(--theme-button-primary-text, #ffffff)',
          }}
          aria-label={buttonText || 'Inscrever-se'}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : buttonText ? (
            <span className="text-sm font-medium whitespace-nowrap">{buttonText}</span>
          ) : (
            <Send className="h-4 w-4" />
          )}
        </button>
      </form>

      {/* Error message */}
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      {/* Editing hint */}
      {isEditing && (
        <p className="text-[10px] opacity-50 italic" style={{ color: textColor || undefined }}>
          [Configure em Tema → Rodapé → Newsletter]
        </p>
      )}
    </div>
  );
}
