-- Add enviar_email_nfe column to fiscal_settings
ALTER TABLE public.fiscal_settings 
ADD COLUMN IF NOT EXISTS enviar_email_nfe BOOLEAN DEFAULT true;

-- Add comment
COMMENT ON COLUMN public.fiscal_settings.enviar_email_nfe IS 'Enviar email ao cliente quando NF-e for autorizada';

-- Insert nfe_autorizada email template
INSERT INTO public.system_email_templates (
  template_key, 
  name, 
  description,
  subject, 
  body_html, 
  variables,
  is_active
) VALUES (
  'nfe_autorizada',
  'NF-e Autorizada',
  'Email enviado ao cliente quando a NF-e é autorizada pela SEFAZ',
  'Sua Nota Fiscal - Pedido {{order_number}}',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #333; margin-bottom: 20px;">Sua Nota Fiscal foi emitida!</h2>
  
  <p style="color: #555; font-size: 16px; line-height: 1.6;">
    Olá <strong>{{customer_name}}</strong>,
  </p>
  
  <p style="color: #555; font-size: 16px; line-height: 1.6;">
    A nota fiscal do seu pedido <strong>{{order_number}}</strong> foi autorizada pela SEFAZ.
  </p>
  
  <div style="background-color: #f5f5f5; border-radius: 8px; padding: 20px; margin: 20px 0;">
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 8px 0; color: #666; font-size: 14px;"><strong>Número da NF-e:</strong></td>
        <td style="padding: 8px 0; color: #333; font-size: 14px;">{{nfe_number}}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #666; font-size: 14px;"><strong>Série:</strong></td>
        <td style="padding: 8px 0; color: #333; font-size: 14px;">{{nfe_serie}}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #666; font-size: 14px;"><strong>Data de Emissão:</strong></td>
        <td style="padding: 8px 0; color: #333; font-size: 14px;">{{data_emissao}}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #666; font-size: 14px;"><strong>Valor Total:</strong></td>
        <td style="padding: 8px 0; color: #333; font-size: 14px; font-weight: bold;">R$ {{valor_total}}</td>
      </tr>
    </table>
  </div>
  
  <div style="background-color: #e8f4e8; border-radius: 8px; padding: 15px; margin: 20px 0;">
    <p style="margin: 0; color: #2d6a2d; font-size: 12px; word-break: break-all;">
      <strong>Chave de Acesso:</strong><br>
      {{chave_acesso}}
    </p>
  </div>
  
  <div style="text-align: center; margin: 30px 0;">
    <a href="{{danfe_url}}" style="display: inline-block; background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 5px; font-size: 14px;">
      📄 Imprimir DANFE (PDF)
    </a>
    <a href="{{xml_url}}" style="display: inline-block; background-color: #2196F3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 5px; font-size: 14px;">
      📥 Baixar XML
    </a>
  </div>
  
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
  
  <p style="color: #888; font-size: 12px; text-align: center;">
    Obrigado pela preferência!<br>
    {{store_name}}
  </p>
</div>',
  ARRAY['customer_name', 'order_number', 'nfe_number', 'nfe_serie', 'data_emissao', 'valor_total', 'chave_acesso', 'danfe_url', 'xml_url', 'store_name'],
  true
) ON CONFLICT (template_key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  subject = EXCLUDED.subject,
  body_html = EXCLUDED.body_html,
  variables = EXCLUDED.variables,
  is_active = EXCLUDED.is_active;