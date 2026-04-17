// =============================================
// OUTROS SETTINGS — Tab "Outros"
// Contém: Inutilização de numeração, Automação de emissão, E-mail da NF-e,
// Criação automática de remessa, Desmembramento de estrutura
// Extraído de FiscalSettingsContent.tsx
// =============================================
import { useState, useEffect } from 'react';
import { Save, Zap, Loader2, Mail, Hash, Truck, Package, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useFiscalSettings, type FiscalSettings } from '@/hooks/useFiscal';
import { toast } from 'sonner';
import { InutilizarNumerosDialog } from '@/components/fiscal/InutilizarNumerosDialog';

const EMIT_STATUS_OPTIONS = [
  { value: 'ready_to_invoice', label: 'Quando pronto para emitir NF (automático)' },
  { value: 'paid', label: 'Após pagamento confirmado (legado)' },
];
const SHIPPING_PROVIDER_OPTIONS = [
  { value: 'correios', label: 'Correios' },
  { value: 'loggi', label: 'Loggi' },
];

export function OutrosSettings() {
  const { settings, isLoading, saveSettings } = useFiscalSettings();
  const [inutilizarDialogOpen, setInutilizarDialogOpen] = useState(false);

  const [formData, setFormData] = useState<Partial<FiscalSettings>>({
    emissao_automatica: false,
    emitir_apos_status: 'ready_to_invoice',
    auto_create_shipment: false,
    auto_update_order_status: true,
    default_shipping_provider: null,
    enviar_email_nfe: true,
    email_nfe_subject: '',
    email_nfe_body: '',
    desmembrar_estrutura: false,
  });

  useEffect(() => {
    if (settings) setFormData(settings);
  }, [settings]);

  const handleChange = (field: keyof FiscalSettings, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => saveSettings.mutate(formData);

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saveSettings.isPending}>
          {saveSettings.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Salvar
        </Button>
      </div>

      {/* Inutilizar Numeração */}
      <Card className="border-secondary/20 bg-secondary/5">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary/10">
              <Hash className="h-6 w-6 text-secondary-foreground" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">Inutilizar Numeração</h3>
              <p className="mt-1 text-sm text-muted-foreground">Inutilize números de NF-e que foram pulados ou não serão utilizados.</p>
            </div>
            <Button variant="outline" onClick={() => setInutilizarDialogOpen(true)}>Inutilizar</Button>
          </div>
        </CardContent>
      </Card>

      {/* Automação de Emissão */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Zap className="h-5 w-5" />Automação de Emissão</CardTitle>
          <CardDescription>Defina quando a NF-e deve ser emitida automaticamente</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="emissao_automatica" className="flex items-center gap-2"><Zap className="h-4 w-4" />Emissão Automática de NF-e</Label>
              <p className="text-xs text-muted-foreground mt-1">Emitir NF-e automaticamente quando o pedido mudar de status</p>
            </div>
            <Switch id="emissao_automatica" checked={formData.emissao_automatica || false} onCheckedChange={(checked) => handleChange('emissao_automatica', checked)} />
          </div>

          {formData.emissao_automatica && (
            <div className="space-y-2">
              <Label htmlFor="emitir_apos_status">Emitir NF-e quando</Label>
              <Select value={formData.emitir_apos_status || 'paid'} onValueChange={(v) => handleChange('emitir_apos_status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{EMIT_STATUS_OPTIONS.map((opt) => (<SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>))}</SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* E-mail da NF-e */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5" />E-mail da NF-e</CardTitle>
          <CardDescription>Configurações do envio automático de e-mail com a NF-e ao cliente</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="enviar_email_nfe" className="flex items-center gap-2"><Mail className="h-4 w-4" />Enviar Email com NF-e ao Cliente</Label>
              <p className="text-xs text-muted-foreground mt-1">Enviar email automático com DANFE e XML quando NF-e for autorizada</p>
            </div>
            <Switch id="enviar_email_nfe" checked={formData.enviar_email_nfe !== false} onCheckedChange={(checked) => handleChange('enviar_email_nfe', checked)} />
          </div>

          {formData.enviar_email_nfe !== false && (
            <div className="space-y-4 p-4 rounded-lg bg-muted/30 border">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground"><Mail className="h-4 w-4" />Personalizar Email da NF-e</div>
              <div className="space-y-2">
                <Label htmlFor="email_nfe_subject">Assunto do Email</Label>
                <Input id="email_nfe_subject" value={formData.email_nfe_subject || ''} onChange={(e) => handleChange('email_nfe_subject', e.target.value)} placeholder="Sua Nota Fiscal - Pedido {{order_number}}" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email_nfe_body">Conteúdo do Email</Label>
                <textarea
                  id="email_nfe_body"
                  className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={formData.email_nfe_body || ''}
                  onChange={(e) => handleChange('email_nfe_body', e.target.value)}
                  placeholder={`Olá {{customer_name}},\n\nSegue anexo a Nota Fiscal referente ao seu pedido {{order_number}}.\n\nNúmero da NF-e: {{nfe_number}}\nSérie: {{nfe_serie}}\nData de Emissão: {{data_emissao}}\nValor Total: {{valor_total}}\n\nVocê pode acessar os documentos nos links abaixo:\n- DANFE: {{danfe_url}}\n- XML: {{xml_url}}\n\nObrigado pela preferência!\n{{store_name}}`}
                />
                <p className="text-xs text-muted-foreground">Deixe em branco para usar o template padrão do sistema</p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Variáveis Disponíveis</Label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { key: '{{customer_name}}', label: 'Nome do Cliente' },
                    { key: '{{order_number}}', label: 'Nº Pedido' },
                    { key: '{{nfe_number}}', label: 'Nº NF-e' },
                    { key: '{{nfe_serie}}', label: 'Série' },
                    { key: '{{data_emissao}}', label: 'Data Emissão' },
                    { key: '{{valor_total}}', label: 'Valor Total' },
                    { key: '{{chave_acesso}}', label: 'Chave de Acesso' },
                    { key: '{{danfe_url}}', label: 'Link DANFE' },
                    { key: '{{xml_url}}', label: 'Link XML' },
                    { key: '{{store_name}}', label: 'Nome da Loja' },
                  ].map((variable) => (
                    <Badge key={variable.key} variant="secondary" className="cursor-pointer hover:bg-secondary/80 text-xs"
                      onClick={() => { navigator.clipboard.writeText(variable.key); toast.success(`${variable.key} copiado!`); }}
                      title={`Clique para copiar: ${variable.label}`}>
                      {variable.key}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Remessa Automática */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Truck className="h-5 w-5" />Remessa Automática</CardTitle>
          <CardDescription>Geração automática de etiqueta após autorização da NF-e</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="auto_create_shipment" className="flex items-center gap-2"><Truck className="h-4 w-4" />Criar Remessa Automaticamente</Label>
              <p className="text-xs text-muted-foreground mt-1">Gerar código de rastreio na transportadora após NF-e autorizada</p>
            </div>
            <Switch id="auto_create_shipment" checked={formData.auto_create_shipment || false} onCheckedChange={(checked) => handleChange('auto_create_shipment', checked)} />
          </div>

          {formData.auto_create_shipment && (
            <>
              <div className="space-y-2">
                <Label htmlFor="default_shipping_provider">Transportadora Padrão</Label>
                <Select value={formData.default_shipping_provider || ''} onValueChange={(v) => handleChange('default_shipping_provider', v)}>
                  <SelectTrigger><SelectValue placeholder="Usar transportadora do pedido" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Usar transportadora do pedido</SelectItem>
                    {SHIPPING_PROVIDER_OPTIONS.map((opt) => (<SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">A transportadora deve estar configurada em Integrações</p>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="auto_update_order_status">Atualizar Status do Pedido</Label>
                  <p className="text-xs text-muted-foreground mt-1">Marcar pedido como "Etiqueta Criada" após gerar remessa</p>
                </div>
                <Switch id="auto_update_order_status" checked={formData.auto_update_order_status !== false} onCheckedChange={(checked) => handleChange('auto_update_order_status', checked)} />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Desmembramento de Estrutura */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" />Desmembramento de Kits</CardTitle>
          <CardDescription>Como kits e produtos com composição aparecem na NF-e</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="desmembrar_estrutura" className="flex items-center gap-2"><Package className="h-4 w-4" />Desmembrar Estrutura do Produto na NF-e</Label>
              <p className="text-xs text-muted-foreground mt-1">Produtos com composição (kits) serão desmembrados em seus componentes na NF-e</p>
            </div>
            <Switch id="desmembrar_estrutura" checked={formData.desmembrar_estrutura || false} onCheckedChange={(checked) => handleChange('desmembrar_estrutura', checked)} />
          </div>
          {formData.desmembrar_estrutura && (
            <div className="p-3 bg-muted/50 rounded-lg border text-sm">
              <p className="font-medium mb-1">Exemplo:</p>
              <p className="text-muted-foreground">Um "Kit 2x Shampoo + 2x Suplemento" aparecerá na NF-e como:</p>
              <ul className="list-disc list-inside text-muted-foreground mt-1">
                <li>Item 1: Shampoo (Qtde: 2)</li>
                <li>Item 2: Suplemento (Qtde: 2)</li>
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <InutilizarNumerosDialog open={inutilizarDialogOpen} onOpenChange={setInutilizarDialogOpen} serie={settings?.serie_nfe} />
    </div>
  );
}
