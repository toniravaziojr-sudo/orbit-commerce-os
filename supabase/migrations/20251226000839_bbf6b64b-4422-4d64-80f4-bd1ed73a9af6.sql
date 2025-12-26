-- Drop the table if it exists (partial migration)
DROP TABLE IF EXISTS public.system_email_templates;

-- Create system_email_templates table
CREATE TABLE public.system_email_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  variables TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.system_email_templates ENABLE ROW LEVEL SECURITY;

-- Only platform admin can view templates (check by email)
CREATE POLICY "Only platform admin can view system email templates"
ON public.system_email_templates
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.email = 'respeiteohomem@gmail.com'
  )
);

-- Only platform admin can update templates
CREATE POLICY "Only platform admin can update system email templates"
ON public.system_email_templates
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.email = 'respeiteohomem@gmail.com'
  )
);

-- Insert default templates
INSERT INTO public.system_email_templates (template_key, name, description, subject, body_html, variables) VALUES
(
  'auth_confirm',
  'Confirmação de Conta',
  'Email enviado quando o usuário cria uma conta e precisa confirmar o email',
  'Confirme sua conta - {{app_name}}',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <h1 style="color: #333;">Confirme sua conta</h1>
    <p>Olá {{user_name}},</p>
    <p>Obrigado por se cadastrar no {{app_name}}!</p>
    <p>Para confirmar sua conta, clique no botão abaixo:</p>
    <p style="text-align: center; margin: 30px 0;">
      <a href="{{confirmation_url}}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Confirmar minha conta</a>
    </p>
    <p>Se você não criou esta conta, ignore este email.</p>
    <p>Atenciosamente,<br>Equipe {{app_name}}</p>
  </div>',
  ARRAY['app_name', 'user_name', 'confirmation_url']
),
(
  'welcome',
  'Boas-vindas',
  'Email enviado após o usuário confirmar a conta com sucesso',
  'Bem-vindo ao {{app_name}}! 🎉',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <h1 style="color: #333;">Bem-vindo ao {{app_name}}!</h1>
    <p>Olá {{user_name}},</p>
    <p>Sua conta foi criada com sucesso! Estamos muito felizes em ter você conosco.</p>
    <p>Agora você pode:</p>
    <ul>
      <li>Acessar sua loja e começar a personalizar</li>
      <li>Adicionar produtos e categorias</li>
      <li>Configurar métodos de pagamento e envio</li>
    </ul>
    <p style="text-align: center; margin: 30px 0;">
      <a href="{{dashboard_url}}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Acessar minha conta</a>
    </p>
    <p>Se precisar de ajuda, estamos à disposição!</p>
    <p>Atenciosamente,<br>Equipe {{app_name}}</p>
  </div>',
  ARRAY['app_name', 'user_name', 'dashboard_url']
),
(
  'password_reset',
  'Recuperação de Senha',
  'Email enviado quando o usuário solicita recuperação de senha',
  'Redefinir sua senha - {{app_name}}',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <h1 style="color: #333;">Redefinir sua senha</h1>
    <p>Olá {{user_name}},</p>
    <p>Recebemos uma solicitação para redefinir a senha da sua conta no {{app_name}}.</p>
    <p>Clique no botão abaixo para criar uma nova senha:</p>
    <p style="text-align: center; margin: 30px 0;">
      <a href="{{reset_url}}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Redefinir minha senha</a>
    </p>
    <p>Este link expira em 24 horas.</p>
    <p>Se você não solicitou esta alteração, ignore este email. Sua senha permanecerá a mesma.</p>
    <p>Atenciosamente,<br>Equipe {{app_name}}</p>
  </div>',
  ARRAY['app_name', 'user_name', 'reset_url']
),
(
  'tutorials',
  'Tutoriais e Instruções',
  'Email com instruções e tutoriais de como usar o aplicativo',
  'Aprenda a usar o {{app_name}} - Guia Rápido',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <h1 style="color: #333;">Guia Rápido - {{app_name}}</h1>
    <p>Olá {{user_name}},</p>
    <p>Preparamos este guia para ajudá-lo a começar a usar o {{app_name}} da melhor forma possível.</p>
    
    <h2 style="color: #4F46E5; margin-top: 30px;">📦 1. Configure sua Loja</h2>
    <p>Acesse as configurações e personalize o nome, logo e cores da sua loja.</p>
    
    <h2 style="color: #4F46E5; margin-top: 30px;">🛍️ 2. Adicione Produtos</h2>
    <p>Cadastre seus produtos com fotos, descrições e preços atrativos.</p>
    
    <h2 style="color: #4F46E5; margin-top: 30px;">💳 3. Configure Pagamentos</h2>
    <p>Ative os métodos de pagamento que deseja aceitar.</p>
    
    <h2 style="color: #4F46E5; margin-top: 30px;">🚚 4. Configure Envios</h2>
    <p>Defina as opções de frete para seus clientes.</p>
    
    <p style="text-align: center; margin: 30px 0;">
      <a href="{{dashboard_url}}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Acessar minha conta</a>
    </p>
    
    <p>Dúvidas? Responda este email que teremos prazer em ajudar!</p>
    <p>Atenciosamente,<br>Equipe {{app_name}}</p>
  </div>',
  ARRAY['app_name', 'user_name', 'dashboard_url']
);

-- Create trigger for updated_at
CREATE TRIGGER update_system_email_templates_updated_at
BEFORE UPDATE ON public.system_email_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();