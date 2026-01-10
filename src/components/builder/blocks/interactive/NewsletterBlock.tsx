// =============================================
// NEWSLETTER BLOCK - Email capture form
// =============================================

import React, { useState } from 'react';
import { Mail, Send, Loader2, CheckCircle, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface NewsletterBlockProps {
  title?: string;
  subtitle?: string;
  placeholder?: string;
  buttonText?: string;
  successMessage?: string;
  layout?: 'horizontal' | 'vertical' | 'card';
  showIcon?: boolean;
  showIncentive?: boolean;
  incentiveText?: string;
  backgroundColor?: string;
  textColor?: string;
  buttonBgColor?: string;
  buttonTextColor?: string;
  isEditing?: boolean;
}

export function NewsletterBlock({
  title = 'Receba nossas novidades',
  subtitle = 'Cadastre-se e receba ofertas exclusivas em primeira mão!',
  placeholder = 'Digite seu e-mail',
  buttonText = 'Inscrever-se',
  successMessage = 'Obrigado! Você foi inscrito com sucesso.',
  layout = 'horizontal',
  showIcon = true,
  showIncentive = false,
  incentiveText = '🎁 Ganhe 10% OFF na primeira compra!',
  backgroundColor,
  textColor,
  buttonBgColor,
  buttonTextColor,
  isEditing,
}: NewsletterBlockProps) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditing) return;
    
    if (!email || !email.includes('@')) {
      setError('Por favor, insira um e-mail válido');
      return;
    }

    setIsLoading(true);
    setError('');

    // Simulate API call - in production, integrate with actual newsletter service
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    setIsLoading(false);
    setIsSuccess(true);
    setEmail('');
  };

  const containerStyle: React.CSSProperties = {
    backgroundColor: backgroundColor || undefined,
    color: textColor || undefined,
  };

  const buttonStyle: React.CSSProperties = {
    backgroundColor: buttonBgColor || undefined,
    color: buttonTextColor || undefined,
  };

  if (isSuccess && !isEditing) {
    return (
      <div 
        className="py-12 px-4"
        style={containerStyle}
      >
        <div className="max-w-2xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 text-green-600 mb-4">
            <CheckCircle className="w-8 h-8" />
          </div>
          <p className="text-lg font-medium">{successMessage}</p>
        </div>
      </div>
    );
  }

  // Vertical/Card layout
  if (layout === 'vertical' || layout === 'card') {
    return (
      <div 
        className={cn(
          "py-12 px-4",
          layout === 'card' && "bg-muted/50"
        )}
        style={containerStyle}
      >
        <div className={cn(
          "max-w-md mx-auto text-center",
          layout === 'card' && "bg-card p-8 rounded-xl shadow-lg border"
        )}>
          {showIcon && (
            <div className="flex justify-center mb-4">
              <div className="p-3 rounded-full bg-primary/10">
                <Mail className="w-8 h-8 text-primary" />
              </div>
            </div>
          )}
          
          {title && (
            <h2 className="text-2xl font-bold mb-2">{title}</h2>
          )}
          
          {subtitle && (
            <p className="text-muted-foreground mb-4">{subtitle}</p>
          )}

          {showIncentive && incentiveText && (
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-full text-sm font-medium mb-6">
              <Gift className="w-4 h-4" />
              {incentiveText}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <Input
              type="email"
              placeholder={placeholder}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="text-center"
              disabled={isEditing}
            />
            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading || isEditing}
              style={buttonStyle}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              {buttonText}
            </Button>
          </form>

          {error && (
            <p className="text-destructive text-sm mt-2">{error}</p>
          )}

          <p className="text-xs text-muted-foreground mt-4">
            Ao se inscrever, você concorda com nossa política de privacidade.
          </p>
        </div>
      </div>
    );
  }

  // Horizontal layout (default)
  return (
    <div 
      className="py-12 px-4 bg-muted/50"
      style={containerStyle}
    >
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col md:flex-row items-center gap-6 md:gap-8">
          {/* Left side - Text */}
          <div className="flex-1 text-center md:text-left">
            <div className="flex items-center gap-3 justify-center md:justify-start mb-2">
              {showIcon && <Mail className="w-6 h-6 text-primary" />}
              {title && <h2 className="text-xl font-bold">{title}</h2>}
            </div>
            {subtitle && (
              <p className="text-muted-foreground">{subtitle}</p>
            )}
            {showIncentive && incentiveText && (
              <div className="inline-flex items-center gap-2 mt-2 text-primary text-sm font-medium">
                <Gift className="w-4 h-4" />
                {incentiveText}
              </div>
            )}
          </div>

          {/* Right side - Form */}
          <form onSubmit={handleSubmit} className="flex-1 w-full">
            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                type="email"
                placeholder={placeholder}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1"
                disabled={isEditing}
              />
              <Button 
                type="submit" 
                disabled={isLoading || isEditing}
                style={buttonStyle}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                {buttonText}
              </Button>
            </div>
            {error && (
              <p className="text-destructive text-sm mt-2">{error}</p>
            )}
          </form>
        </div>
      </div>

      {isEditing && (
        <p className="text-center text-sm text-muted-foreground mt-4">
          [Configure a newsletter no painel lateral]
        </p>
      )}
    </div>
  );
}
