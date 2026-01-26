import { useState } from "react";
import { Info, Eye, EyeOff } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import type { NotificationChannel } from "@/hooks/useNotificationRulesV2";

interface MessageEditorProps {
  channels: NotificationChannel[];
  whatsappMessage: string;
  emailSubject: string;
  emailBody: string;
  onWhatsappMessageChange: (message: string) => void;
  onEmailSubjectChange: (subject: string) => void;
  onEmailBodyChange: (body: string) => void;
}

const dynamicVariables = [
  { key: '{{customer_name}}', label: 'Nome completo', example: 'João da Silva' },
  { key: '{{customer_first_name}}', label: 'Primeiro nome', example: 'João' },
  { key: '{{customer_email}}', label: 'E-mail', example: 'joao@email.com' },
  { key: '{{customer_phone}}', label: 'Telefone', example: '11999999999' },
  { key: '{{order_number}}', label: 'Número do pedido', example: 'PED-25-000001' },
  { key: '{{order_total}}', label: 'Valor total', example: 'R$ 199,90' },
  { key: '{{order_status}}', label: 'Status do pedido', example: 'Pago' },
  { key: '{{payment_status}}', label: 'Status do pagamento', example: 'Aprovado' },
  { key: '{{payment_method}}', label: 'Método de pagamento', example: 'PIX' },
  { key: '{{pix_code}}', label: 'Código PIX', example: '00020126...' },
  { key: '{{pix_link}}', label: 'Link do PIX', example: 'https://...' },
  { key: '{{boleto_link}}', label: 'Link do boleto', example: 'https://...' },
  { key: '{{boleto_barcode}}', label: 'Código de barras', example: '23793.38128...' },
  { key: '{{tracking_code}}', label: 'Código de rastreio', example: 'BR123456789' },
  { key: '{{tracking_url}}', label: 'Link de rastreio', example: 'https://...' },
  { key: '{{shipping_status}}', label: 'Status do envio', example: 'Em trânsito' },
  { key: '{{product_names}}', label: 'Nomes dos produtos', example: 'Camiseta, Calça' },
  { key: '{{store_name}}', label: 'Nome da loja', example: 'Minha Loja' },
  { key: '{{review_link}}', label: 'Link de avaliação', example: 'https://loja.com/avaliar/abc123' },
  { key: '{{products_review_links}}', label: 'Links por produto', example: 'Camiseta: https://...\nCalça: https://...' },
];

// Sample values for preview
const sampleValues: Record<string, string> = {
  '{{customer_name}}': 'João da Silva',
  '{{customer_first_name}}': 'João',
  '{{customer_email}}': 'joao@email.com',
  '{{customer_phone}}': '11999999999',
  '{{order_number}}': 'PED-25-000001',
  '{{order_total}}': 'R$ 199,90',
  '{{order_status}}': 'Pago',
  '{{payment_status}}': 'Aprovado',
  '{{payment_method}}': 'PIX',
  '{{pix_code}}': '00020126580014br.gov.bcb.pix...',
  '{{pix_link}}': 'https://pix.exemplo.com/...',
  '{{boleto_link}}': 'https://boleto.exemplo.com/...',
  '{{boleto_barcode}}': '23793.38128 60000.000003...',
  '{{tracking_code}}': 'BR123456789BR',
  '{{tracking_url}}': 'https://rastreio.exemplo.com/...',
  '{{shipping_status}}': 'Em trânsito',
  '{{product_names}}': 'Camiseta Preta, Calça Jeans',
  '{{store_name}}': 'Minha Loja',
  '{{review_link}}': 'https://minhaloja.com/avaliar/abc123xyz',
  '{{products_review_links}}': 'Camiseta Preta: https://minhaloja.com/avaliar/abc123?product=123\nCalça Jeans: https://minhaloja.com/avaliar/abc123?product=456',
};

function renderPreview(text: string, isWhatsapp: boolean): string {
  let rendered = text;
  // Replace variables with sample values
  for (const [key, value] of Object.entries(sampleValues)) {
    rendered = rendered.split(key).join(value);
  }
  // Convert bold markers to display format
  if (isWhatsapp) {
    // WhatsApp: *bold* stays as is for preview display
    rendered = rendered.replace(/\*([^*]+)\*/g, '<strong>$1</strong>');
  } else {
    // Email: **bold** to HTML
    rendered = rendered.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  }
  return rendered;
}

export function MessageEditor({
  channels,
  whatsappMessage,
  emailSubject,
  emailBody,
  onWhatsappMessageChange,
  onEmailSubjectChange,
  onEmailBodyChange,
}: MessageEditorProps) {
  const [activeTab, setActiveTab] = useState<string>(channels[0] || 'whatsapp');
  const [showPreview, setShowPreview] = useState(false);

  const insertVariable = (variable: string, target: 'whatsapp' | 'email_subject' | 'email_body') => {
    switch (target) {
      case 'whatsapp':
        onWhatsappMessageChange(whatsappMessage + variable);
        break;
      case 'email_subject':
        onEmailSubjectChange(emailSubject + variable);
        break;
      case 'email_body':
        onEmailBodyChange(emailBody + variable);
        break;
    }
  };

  const wrapWithBold = (text: string, isWhatsapp: boolean): string => {
    const selection = window.getSelection()?.toString();
    if (selection) {
      if (isWhatsapp) {
        return text.replace(selection, `*${selection}*`);
      } else {
        return text.replace(selection, `**${selection}**`);
      }
    }
    return text;
  };

  const VariablesPopover = ({ target }: { target: 'whatsapp' | 'email_subject' | 'email_body' }) => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" type="button" className="gap-1">
          <Info className="h-3 w-3" />
          Variáveis
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 max-h-64 overflow-y-auto" align="start">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground mb-2">Clique para inserir:</p>
          <div className="flex flex-wrap gap-1">
            {dynamicVariables.map((v) => (
              <Badge
                key={v.key}
                variant="secondary"
                className="cursor-pointer hover:bg-primary hover:text-primary-foreground text-xs"
                onClick={() => insertVariable(v.key, target)}
              >
                {v.label}
              </Badge>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base font-medium">Mensagens</Label>
        <Button
          variant="outline"
          size="sm"
          type="button"
          onClick={() => setShowPreview(!showPreview)}
          className="gap-1"
        >
          {showPreview ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          {showPreview ? 'Ocultar' : 'Preview'}
        </Button>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          {channels.includes('whatsapp') && (
            <TabsTrigger value="whatsapp" className="gap-2">
              WhatsApp
            </TabsTrigger>
          )}
          {channels.includes('email') && (
            <TabsTrigger value="email" className="gap-2">
              E-mail
            </TabsTrigger>
          )}
        </TabsList>

        {channels.includes('whatsapp') && (
          <TabsContent value="whatsapp" className="space-y-3">
            <div className="flex items-center gap-2">
              <VariablesPopover target="whatsapp" />
              <p className="text-xs text-muted-foreground">
                Use *texto* para <strong>negrito</strong>
              </p>
            </div>
            <Textarea
              value={whatsappMessage}
              onChange={(e) => onWhatsappMessageChange(e.target.value)}
              placeholder="Olá {{customer_first_name}}! Seu pedido {{order_number}} foi confirmado. 🎉"
              rows={6}
              className="font-mono text-sm"
            />
            {showPreview && whatsappMessage && (
              <Card className="bg-green-50 dark:bg-green-950/20 border-green-200">
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground mb-2">Preview WhatsApp:</p>
                  <div 
                    className="text-sm whitespace-pre-wrap"
                    dangerouslySetInnerHTML={{ __html: renderPreview(whatsappMessage, true) }}
                  />
                </CardContent>
              </Card>
            )}
          </TabsContent>
        )}

        {channels.includes('email') && (
          <TabsContent value="email" className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="email-subject">Título do E-mail</Label>
                <VariablesPopover target="email_subject" />
              </div>
              <Input
                id="email-subject"
                value={emailSubject}
                onChange={(e) => onEmailSubjectChange(e.target.value)}
                placeholder="Seu pedido {{order_number}} foi confirmado!"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="email-body">Corpo do E-mail</Label>
                <div className="flex gap-2">
                  <VariablesPopover target="email_body" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Use **texto** para <strong>negrito</strong>
              </p>
              <Textarea
                id="email-body"
                value={emailBody}
                onChange={(e) => onEmailBodyChange(e.target.value)}
                placeholder="Olá {{customer_first_name}},

Seu pedido **{{order_number}}** no valor de {{order_total}} foi confirmado com sucesso!

Você pode acompanhar o status do seu pedido a qualquer momento.

Atenciosamente,
{{store_name}}"
                rows={10}
                className="font-mono text-sm"
              />
            </div>

            {showPreview && (emailSubject || emailBody) && (
              <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200">
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground mb-2">Preview E-mail:</p>
                  {emailSubject && (
                    <p 
                      className="font-medium mb-2"
                      dangerouslySetInnerHTML={{ __html: renderPreview(emailSubject, false) }}
                    />
                  )}
                  {emailBody && (
                    <div 
                      className="text-sm whitespace-pre-wrap border-t pt-2"
                      dangerouslySetInnerHTML={{ __html: renderPreview(emailBody, false) }}
                    />
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
