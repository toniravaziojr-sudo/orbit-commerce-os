// =============================================
// CONTACT FORM BLOCK - Contact form with validation
// =============================================

import React, { useState } from 'react';
import { Send, Loader2, CheckCircle, Mail, Phone, MapPin, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface ContactFormBlockProps {
  title?: string;
  subtitle?: string;
  layout?: 'simple' | 'with-info' | 'split';
  // Form fields config
  showName?: boolean;
  showPhone?: boolean;
  showSubject?: boolean;
  // Labels
  nameLabel?: string;
  emailLabel?: string;
  phoneLabel?: string;
  subjectLabel?: string;
  messageLabel?: string;
  buttonText?: string;
  successMessage?: string;
  // Contact info (for 'with-info' and 'split' layouts)
  showContactInfo?: boolean;
  contactEmail?: string;
  contactPhone?: string;
  contactAddress?: string;
  contactHours?: string;
  // Styling
  backgroundColor?: string;
  textColor?: string;
  buttonBgColor?: string;
  buttonTextColor?: string;
  isEditing?: boolean;
}

export function ContactFormBlock({
  title = 'Entre em Contato',
  subtitle = 'Preencha o formulário abaixo e entraremos em contato em breve.',
  layout = 'simple',
  showName = true,
  showPhone = false,
  showSubject = true,
  nameLabel = 'Nome',
  emailLabel = 'E-mail',
  phoneLabel = 'Telefone',
  subjectLabel = 'Assunto',
  messageLabel = 'Mensagem',
  buttonText = 'Enviar Mensagem',
  successMessage = 'Mensagem enviada com sucesso! Entraremos em contato em breve.',
  showContactInfo = true,
  // IMPORTANT: Contact info defaults should be empty in public mode
  // Demo values only appear if explicitly set or in builder mode
  contactEmail = '',
  contactPhone = '',
  contactAddress = '',
  contactHours = '',
  backgroundColor,
  textColor,
  buttonBgColor,
  buttonTextColor,
  isEditing,
}: ContactFormBlockProps) {
  // Demo values for builder mode only
  const demoEmail = 'contato@sualoja.com';
  const demoPhone = '(11) 99999-9999';
  const demoAddress = 'Rua Exemplo, 123 - São Paulo, SP';
  const demoHours = 'Seg - Sex: 9h às 18h';
  
  // Use provided values, or show demo only in builder mode
  const displayEmail = contactEmail || (isEditing ? demoEmail : '');
  const displayPhone = contactPhone || (isEditing ? demoPhone : '');
  const displayAddress = contactAddress || (isEditing ? demoAddress : '');
  const displayHours = contactHours || (isEditing ? demoHours : '');
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (showName && !formData.name.trim()) {
      newErrors.name = 'Nome é obrigatório';
    }
    
    if (!formData.email.trim() || !formData.email.includes('@')) {
      newErrors.email = 'E-mail inválido';
    }
    
    if (!formData.message.trim()) {
      newErrors.message = 'Mensagem é obrigatória';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditing) return;
    
    if (!validateForm()) return;

    setIsLoading(true);

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    setIsLoading(false);
    setIsSuccess(true);
    setFormData({ name: '', email: '', phone: '', subject: '', message: '' });
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
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

  if (isSuccess && !isEditing) {
    return (
      <div className="py-16 px-4" style={containerStyle}>
        <div className="max-w-xl mx-auto text-center">
          <div className="flex items-center justify-center mb-6">
            <div className="p-4 rounded-full bg-green-100">
              <CheckCircle className="w-12 h-12 text-green-600" />
            </div>
          </div>
          <h3 className="text-2xl font-bold mb-2">Mensagem Enviada!</h3>
          <p className="text-muted-foreground">{successMessage}</p>
          <Button 
            variant="outline" 
            className="mt-6"
            onClick={() => setIsSuccess(false)}
          >
            Enviar outra mensagem
          </Button>
        </div>
      </div>
    );
  }

  const FormFields = () => (
    <form onSubmit={handleSubmit} className="space-y-4">
      {showName && (
        <div className="space-y-2">
          <Label htmlFor="name">{nameLabel}</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="Seu nome completo"
            disabled={isEditing}
            className={cn(errors.name && "border-destructive")}
          />
          {errors.name && <p className="text-destructive text-sm">{errors.name}</p>}
        </div>
      )}

      <div className={cn("grid gap-4", showPhone && "sm:grid-cols-2")}>
        <div className="space-y-2">
          <Label htmlFor="email">{emailLabel}</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => handleChange('email', e.target.value)}
            placeholder="seu@email.com"
            disabled={isEditing}
            className={cn(errors.email && "border-destructive")}
          />
          {errors.email && <p className="text-destructive text-sm">{errors.email}</p>}
        </div>

        {showPhone && (
          <div className="space-y-2">
            <Label htmlFor="phone">{phoneLabel}</Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              placeholder="(11) 99999-9999"
              disabled={isEditing}
            />
          </div>
        )}
      </div>

      {showSubject && (
        <div className="space-y-2">
          <Label htmlFor="subject">{subjectLabel}</Label>
          <Input
            id="subject"
            value={formData.subject}
            onChange={(e) => handleChange('subject', e.target.value)}
            placeholder="Assunto da mensagem"
            disabled={isEditing}
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="message">{messageLabel}</Label>
        <Textarea
          id="message"
          value={formData.message}
          onChange={(e) => handleChange('message', e.target.value)}
          placeholder="Digite sua mensagem..."
          rows={5}
          disabled={isEditing}
          className={cn(errors.message && "border-destructive")}
        />
        {errors.message && <p className="text-destructive text-sm">{errors.message}</p>}
      </div>

      <Button 
        type="submit" 
        className="w-full sm:w-auto"
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
  );

  const ContactInfo = () => (
    <div className="space-y-6">
      {displayEmail && (
        <div className="flex items-start gap-4">
          <div className="p-2 rounded-lg bg-primary/10">
            <Mail className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="font-medium">E-mail</p>
            <a href={`mailto:${displayEmail}`} className="text-muted-foreground hover:text-primary transition-colors">
              {displayEmail}
            </a>
          </div>
        </div>
      )}

      {displayPhone && (
        <div className="flex items-start gap-4">
          <div className="p-2 rounded-lg bg-primary/10">
            <Phone className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="font-medium">Telefone</p>
            <a href={`tel:${displayPhone.replace(/\D/g, '')}`} className="text-muted-foreground hover:text-primary transition-colors">
              {displayPhone}
            </a>
          </div>
        </div>
      )}

      {displayAddress && (
        <div className="flex items-start gap-4">
          <div className="p-2 rounded-lg bg-primary/10">
            <MapPin className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="font-medium">Endereço</p>
            <p className="text-muted-foreground">{displayAddress}</p>
          </div>
        </div>
      )}

      {displayHours && (
        <div className="flex items-start gap-4">
          <div className="p-2 rounded-lg bg-primary/10">
            <Clock className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="font-medium">Horário de Atendimento</p>
            <p className="text-muted-foreground">{displayHours}</p>
          </div>
        </div>
      )}
    </div>
  );

  // Simple layout
  if (layout === 'simple') {
    return (
      <div className="py-12 px-4" style={containerStyle}>
        <div className="max-w-xl mx-auto">
          {title && <h2 className="text-2xl font-bold mb-2 text-center">{title}</h2>}
          {subtitle && <p className="text-muted-foreground mb-8 text-center">{subtitle}</p>}
          <FormFields />
        </div>
        {isEditing && (
          <p className="text-center text-sm text-muted-foreground mt-4">
            [Configure o formulário no painel lateral]
          </p>
        )}
      </div>
    );
  }

  // Split layout
  if (layout === 'split') {
    return (
      <div className="py-12 px-4" style={containerStyle}>
        <div className="max-w-6xl mx-auto">
          {title && <h2 className="text-3xl font-bold mb-2 text-center">{title}</h2>}
          {subtitle && <p className="text-muted-foreground mb-12 text-center">{subtitle}</p>}
          
          <div className="grid md:grid-cols-2 gap-12">
            {/* Contact Info Side */}
            {showContactInfo && (
              <div className="bg-muted/50 rounded-xl p-8">
                <h3 className="text-xl font-semibold mb-6">Informações de Contato</h3>
                <ContactInfo />
              </div>
            )}

            {/* Form Side */}
            <div>
              <FormFields />
            </div>
          </div>
        </div>
        {isEditing && (
          <p className="text-center text-sm text-muted-foreground mt-4">
            [Configure o formulário no painel lateral]
          </p>
        )}
      </div>
    );
  }

  // With-info layout
  return (
    <div className="py-12 px-4" style={containerStyle}>
      <div className="max-w-4xl mx-auto">
        {title && <h2 className="text-2xl font-bold mb-2 text-center">{title}</h2>}
        {subtitle && <p className="text-muted-foreground mb-8 text-center">{subtitle}</p>}

        {showContactInfo && (
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4 mb-10">
            {contactEmail && (
              <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
                <Mail className="w-5 h-5 text-primary shrink-0" />
                <span className="text-sm truncate">{contactEmail}</span>
              </div>
            )}
            {contactPhone && (
              <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
                <Phone className="w-5 h-5 text-primary shrink-0" />
                <span className="text-sm">{contactPhone}</span>
              </div>
            )}
            {contactAddress && (
              <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
                <MapPin className="w-5 h-5 text-primary shrink-0" />
                <span className="text-sm truncate">{contactAddress}</span>
              </div>
            )}
            {contactHours && (
              <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
                <Clock className="w-5 h-5 text-primary shrink-0" />
                <span className="text-sm">{contactHours}</span>
              </div>
            )}
          </div>
        )}

        <FormFields />
      </div>
      {isEditing && (
        <p className="text-center text-sm text-muted-foreground mt-4">
          [Configure o formulário no painel lateral]
        </p>
      )}
    </div>
  );
}
