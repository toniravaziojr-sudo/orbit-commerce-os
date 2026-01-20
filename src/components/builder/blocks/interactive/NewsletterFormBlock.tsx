// =============================================
// NEWSLETTER FORM BLOCK - Customizable email capture form
// Integrates with Email Marketing lists and tags
// =============================================

import React, { useState } from 'react';
import { Mail, Send, Loader2, CheckCircle, Gift, User, Phone, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

export interface NewsletterFormBlockProps {
  // List integration
  listId?: string;
  formSlug?: string;
  
  // Content
  title?: string;
  subtitle?: string;
  buttonText?: string;
  successMessage?: string;
  privacyText?: string;
  
  // Fields configuration
  showName?: boolean;
  showPhone?: boolean;
  showBirthDate?: boolean;
  nameRequired?: boolean;
  phoneRequired?: boolean;
  birthDateRequired?: boolean;
  namePlaceholder?: string;
  emailPlaceholder?: string;
  phonePlaceholder?: string;
  
  // Layout
  layout?: 'horizontal' | 'vertical' | 'card' | 'minimal';
  
  // Visual
  showIcon?: boolean;
  showIncentive?: boolean;
  incentiveText?: string;
  backgroundColor?: string;
  textColor?: string;
  buttonBgColor?: string;
  buttonTextColor?: string;
  borderRadius?: number;
  
  // Context
  tenantId?: string;
  isEditing?: boolean;
}

export function NewsletterFormBlock({
  listId,
  formSlug = 'newsletter',
  title = 'Receba nossas novidades',
  subtitle = 'Cadastre-se e receba ofertas exclusivas em primeira mão!',
  buttonText = 'Inscrever-se',
  successMessage = 'Obrigado! Você foi inscrito com sucesso.',
  privacyText = 'Ao se inscrever, você concorda com nossa política de privacidade.',
  showName = true,
  showPhone = false,
  showBirthDate = false,
  nameRequired = false,
  phoneRequired = false,
  birthDateRequired = false,
  namePlaceholder = 'Seu nome',
  emailPlaceholder = 'Digite seu e-mail',
  phonePlaceholder = 'Seu telefone',
  layout = 'vertical',
  showIcon = true,
  showIncentive = false,
  incentiveText = '🎁 Ganhe 10% OFF na primeira compra!',
  backgroundColor,
  textColor,
  buttonBgColor,
  buttonTextColor,
  borderRadius = 8,
  tenantId,
  isEditing,
}: NewsletterFormBlockProps) {
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    phone: '',
    birthDate: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditing) return;
    
    // Validation
    if (!formData.email || !formData.email.includes('@')) {
      setError('Por favor, insira um e-mail válido');
      return;
    }
    if (nameRequired && showName && !formData.name.trim()) {
      setError('Por favor, insira seu nome');
      return;
    }
    if (phoneRequired && showPhone && !formData.phone.trim()) {
      setError('Por favor, insira seu telefone');
      return;
    }
    if (birthDateRequired && showBirthDate && !formData.birthDate) {
      setError('Por favor, insira sua data de nascimento');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Call the marketing-form-submit edge function
      const { data, error: fnError } = await supabase.functions.invoke('marketing-form-submit', {
        body: {
          tenant_id: tenantId,
          form_slug: formSlug,
          list_id: listId,
          fields: {
            email: formData.email.toLowerCase().trim(),
            name: formData.name || undefined,
            phone: formData.phone || undefined,
            birth_date: formData.birthDate || undefined,
          },
          source: 'newsletter_form',
        },
      });

      if (fnError) throw fnError;
      if (data && !data.success) throw new Error(data.error);

      setIsSuccess(true);
      setFormData({ email: '', name: '', phone: '', birthDate: '' });
    } catch (err: any) {
      console.error('Newsletter submit error:', err);
      setError('Erro ao enviar. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const containerStyle: React.CSSProperties = {
    backgroundColor: backgroundColor || undefined,
    color: textColor || undefined,
    borderRadius: borderRadius ? `${borderRadius}px` : undefined,
  };

  const buttonStyle: React.CSSProperties = {
    backgroundColor: buttonBgColor || undefined,
    color: buttonTextColor || undefined,
  };

  // Show configuration message in editing mode if no list selected
  if (isEditing && !listId) {
    return (
      <div 
        className="py-12 px-4 bg-muted/30 border-2 border-dashed rounded-lg"
        style={containerStyle}
      >
        <div className="max-w-md mx-auto text-center">
          <Mail className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">Formulário de Newsletter</h3>
          <p className="text-muted-foreground text-sm">
            Selecione uma lista no painel lateral para ativar este formulário.
          </p>
        </div>
      </div>
    );
  }

  // Success state
  if (isSuccess && !isEditing) {
    return (
      <div 
        className="py-12 px-4"
        style={containerStyle}
      >
        <div className="max-w-md mx-auto text-center">
          <div className="flex items-center justify-center gap-2 text-green-600 mb-4">
            <CheckCircle className="w-10 h-10" />
          </div>
          <p className="text-lg font-medium">{successMessage}</p>
        </div>
      </div>
    );
  }

  // Minimal layout
  if (layout === 'minimal') {
    return (
      <div className="py-6 px-4" style={containerStyle}>
        <form onSubmit={handleSubmit} className="max-w-md mx-auto">
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              type="email"
              placeholder={emailPlaceholder}
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              className="flex-1"
              disabled={isEditing}
              required
            />
            <Button 
              type="submit" 
              disabled={isLoading || isEditing}
              style={buttonStyle}
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
          {error && <p className="text-destructive text-sm mt-2">{error}</p>}
        </form>
      </div>
    );
  }

  // Vertical/Card layout
  const isCardLayout = layout === 'card';
  
  return (
    <div 
      className={cn(
        "py-12 px-4",
        isCardLayout && "bg-muted/30"
      )}
      style={!isCardLayout ? containerStyle : undefined}
    >
      <div className={cn(
        "max-w-md mx-auto",
        isCardLayout && "bg-card p-8 rounded-xl shadow-lg border"
      )} style={isCardLayout ? containerStyle : undefined}>
        
        {/* Icon */}
        {showIcon && (
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-full bg-primary/10">
              <Mail className="w-8 h-8 text-primary" />
            </div>
          </div>
        )}
        
        {/* Title & Subtitle */}
        {title && (
          <h2 className="text-2xl font-bold text-center mb-2">{title}</h2>
        )}
        {subtitle && (
          <p className="text-muted-foreground text-center mb-4">{subtitle}</p>
        )}

        {/* Incentive */}
        {showIncentive && incentiveText && (
          <div className="flex justify-center mb-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-full text-sm font-medium">
              <Gift className="w-4 h-4" />
              {incentiveText}
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name field */}
          {showName && (
            <div className="space-y-1">
              <Label htmlFor="name" className="flex items-center gap-2 text-sm">
                <User className="w-4 h-4" />
                Nome {nameRequired && <span className="text-destructive">*</span>}
              </Label>
              <Input
                id="name"
                type="text"
                placeholder={namePlaceholder}
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                disabled={isEditing}
                required={nameRequired}
              />
            </div>
          )}

          {/* Email field (always shown) */}
          <div className="space-y-1">
            <Label htmlFor="email" className="flex items-center gap-2 text-sm">
              <Mail className="w-4 h-4" />
              E-mail <span className="text-destructive">*</span>
            </Label>
            <Input
              id="email"
              type="email"
              placeholder={emailPlaceholder}
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              disabled={isEditing}
              required
            />
          </div>

          {/* Phone field */}
          {showPhone && (
            <div className="space-y-1">
              <Label htmlFor="phone" className="flex items-center gap-2 text-sm">
                <Phone className="w-4 h-4" />
                Telefone {phoneRequired && <span className="text-destructive">*</span>}
              </Label>
              <Input
                id="phone"
                type="tel"
                placeholder={phonePlaceholder}
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                disabled={isEditing}
                required={phoneRequired}
              />
            </div>
          )}

          {/* Birth Date field */}
          {showBirthDate && (
            <div className="space-y-1">
              <Label htmlFor="birthDate" className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4" />
                Data de Nascimento {birthDateRequired && <span className="text-destructive">*</span>}
              </Label>
              <Input
                id="birthDate"
                type="date"
                value={formData.birthDate}
                onChange={(e) => setFormData(prev => ({ ...prev, birthDate: e.target.value }))}
                disabled={isEditing}
                required={birthDateRequired}
              />
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="text-destructive text-sm">{error}</p>
          )}

          {/* Submit button */}
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

        {/* Privacy text */}
        {privacyText && (
          <p className="text-xs text-muted-foreground text-center mt-4">
            {privacyText}
          </p>
        )}
      </div>

      {isEditing && (
        <p className="text-center text-sm text-muted-foreground mt-4">
          [Configure os campos e a lista no painel lateral]
        </p>
      )}
    </div>
  );
}
