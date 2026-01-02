import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, TestTube, Building2, MapPin, FileText, Settings2, Zap, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useFiscalSettings, type FiscalSettings } from '@/hooks/useFiscal';
import { toast } from 'sonner';

// Brazilian states
const UF_OPTIONS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

// CRT options
const CRT_OPTIONS = [
  { value: '1', label: '1 - Simples Nacional' },
  { value: '2', label: '2 - Simples Nacional (excesso)' },
  { value: '3', label: '3 - Regime Normal' },
];

// Ambiente options
const AMBIENTE_OPTIONS = [
  { value: 'homologacao', label: 'Homologação (testes)' },
  { value: 'producao', label: 'Produção' },
];

// Order status options for auto-emit
const EMIT_STATUS_OPTIONS = [
  { value: 'paid', label: 'Após pagamento confirmado' },
  { value: 'shipped', label: 'Após envio' },
  { value: 'processing', label: 'Após processamento' },
];

function formatCNPJ(value: string) {
  const numbers = value.replace(/\D/g, '').slice(0, 14);
  return numbers.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2}).*/, '$1.$2.$3/$4-$5');
}

function formatCEP(value: string) {
  const numbers = value.replace(/\D/g, '').slice(0, 8);
  return numbers.replace(/^(\d{5})(\d{3}).*/, '$1-$2');
}

export default function FiscalSettings() {
  const navigate = useNavigate();
  const { settings, isLoading, saveSettings } = useFiscalSettings();
  
  const [formData, setFormData] = useState<Partial<FiscalSettings>>({
    razao_social: '',
    nome_fantasia: '',
    cnpj: '',
    inscricao_estadual: '',
    ie_isento: false,
    cnae: '',
    endereco_logradouro: '',
    endereco_numero: '',
    endereco_complemento: '',
    endereco_bairro: '',
    endereco_municipio: '',
    endereco_municipio_codigo: '',
    endereco_uf: '',
    endereco_cep: '',
    crt: 1,
    cfop_intrastadual: '5102',
    cfop_interestadual: '6102',
    csosn_padrao: '',
    cst_padrao: '',
    serie_nfe: 1,
    numero_nfe_atual: 1,
    provider: 'focusnfe',
    provider_token: '',
    ambiente: 'homologacao',
    emissao_automatica: false,
    emitir_apos_status: 'paid',
  });

  // Load existing settings
  useEffect(() => {
    if (settings) {
      setFormData({
        ...settings,
        crt: settings.crt || 1,
      });
    }
  }, [settings]);

  const handleChange = (field: keyof FiscalSettings, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCNPJChange = (value: string) => {
    handleChange('cnpj', formatCNPJ(value));
  };

  const handleCEPChange = (value: string) => {
    handleChange('endereco_cep', formatCEP(value));
  };

  const handleSave = () => {
    // Basic validation
    if (!formData.razao_social?.trim()) {
      toast.error('Razão Social é obrigatória');
      return;
    }
    if (!formData.cnpj || formData.cnpj.replace(/\D/g, '').length !== 14) {
      toast.error('CNPJ inválido');
      return;
    }
    if (!formData.ie_isento && !formData.inscricao_estadual?.trim()) {
      toast.error('Inscrição Estadual é obrigatória (ou marque como Isento)');
      return;
    }
    
    saveSettings.mutate(formData);
  };

  const isConfigured = settings?.is_configured;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/settings')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Configurações Fiscais</h1>
            <p className="text-muted-foreground">Configure a emissão de NF-e para sua loja</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isConfigured ? (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle className="h-4 w-4" />
              Configurado
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-amber-600">
              <AlertCircle className="h-4 w-4" />
              Incompleto
            </div>
          )}
          <Button onClick={handleSave} disabled={saveSettings.isPending}>
            {saveSettings.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Salvar
          </Button>
        </div>
      </div>

      {/* Alert if not configured */}
      {!isConfigured && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Preencha todos os campos obrigatórios para habilitar a emissão de NF-e.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Dados do Emitente */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Dados do Emitente
            </CardTitle>
            <CardDescription>Informações da empresa para NF-e</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="razao_social">Razão Social *</Label>
              <Input
                id="razao_social"
                value={formData.razao_social || ''}
                onChange={(e) => handleChange('razao_social', e.target.value)}
                placeholder="Razão social completa"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nome_fantasia">Nome Fantasia</Label>
              <Input
                id="nome_fantasia"
                value={formData.nome_fantasia || ''}
                onChange={(e) => handleChange('nome_fantasia', e.target.value)}
                placeholder="Nome fantasia (opcional)"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cnpj">CNPJ *</Label>
                <Input
                  id="cnpj"
                  value={formData.cnpj || ''}
                  onChange={(e) => handleCNPJChange(e.target.value)}
                  placeholder="00.000.000/0000-00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cnae">CNAE</Label>
                <Input
                  id="cnae"
                  value={formData.cnae || ''}
                  onChange={(e) => handleChange('cnae', e.target.value)}
                  placeholder="0000-0/00"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="inscricao_estadual">Inscrição Estadual *</Label>
                <div className="flex items-center gap-2">
                  <Switch
                    id="ie_isento"
                    checked={formData.ie_isento || false}
                    onCheckedChange={(checked) => handleChange('ie_isento', checked)}
                  />
                  <Label htmlFor="ie_isento" className="text-sm font-normal">Isento</Label>
                </div>
              </div>
              <Input
                id="inscricao_estadual"
                value={formData.inscricao_estadual || ''}
                onChange={(e) => handleChange('inscricao_estadual', e.target.value)}
                placeholder="Inscrição Estadual"
                disabled={formData.ie_isento}
              />
            </div>
          </CardContent>
        </Card>

        {/* Endereço */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Endereço do Emitente
            </CardTitle>
            <CardDescription>Endereço fiscal da empresa</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="endereco_logradouro">Logradouro *</Label>
                <Input
                  id="endereco_logradouro"
                  value={formData.endereco_logradouro || ''}
                  onChange={(e) => handleChange('endereco_logradouro', e.target.value)}
                  placeholder="Rua, Avenida, etc."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endereco_numero">Número *</Label>
                <Input
                  id="endereco_numero"
                  value={formData.endereco_numero || ''}
                  onChange={(e) => handleChange('endereco_numero', e.target.value)}
                  placeholder="Nº"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="endereco_complemento">Complemento</Label>
                <Input
                  id="endereco_complemento"
                  value={formData.endereco_complemento || ''}
                  onChange={(e) => handleChange('endereco_complemento', e.target.value)}
                  placeholder="Sala, Andar, etc."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endereco_bairro">Bairro *</Label>
                <Input
                  id="endereco_bairro"
                  value={formData.endereco_bairro || ''}
                  onChange={(e) => handleChange('endereco_bairro', e.target.value)}
                  placeholder="Bairro"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="endereco_municipio">Município *</Label>
                <Input
                  id="endereco_municipio"
                  value={formData.endereco_municipio || ''}
                  onChange={(e) => handleChange('endereco_municipio', e.target.value)}
                  placeholder="Cidade"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endereco_uf">UF *</Label>
                <Select
                  value={formData.endereco_uf || ''}
                  onValueChange={(v) => handleChange('endereco_uf', v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {UF_OPTIONS.map((uf) => (
                      <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="endereco_cep">CEP *</Label>
                <Input
                  id="endereco_cep"
                  value={formData.endereco_cep || ''}
                  onChange={(e) => handleCEPChange(e.target.value)}
                  placeholder="00000-000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endereco_municipio_codigo">Código IBGE</Label>
                <Input
                  id="endereco_municipio_codigo"
                  value={formData.endereco_municipio_codigo || ''}
                  onChange={(e) => handleChange('endereco_municipio_codigo', e.target.value)}
                  placeholder="Código IBGE (opcional)"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Parâmetros Fiscais */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Parâmetros Fiscais
            </CardTitle>
            <CardDescription>Configurações tributárias padrão</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="crt">Regime Tributário (CRT) *</Label>
              <Select
                value={String(formData.crt || 1)}
                onValueChange={(v) => handleChange('crt', parseInt(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o regime" />
                </SelectTrigger>
                <SelectContent>
                  {CRT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cfop_intrastadual">CFOP Intrastadual</Label>
                <Input
                  id="cfop_intrastadual"
                  value={formData.cfop_intrastadual || ''}
                  onChange={(e) => handleChange('cfop_intrastadual', e.target.value)}
                  placeholder="5102"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cfop_interestadual">CFOP Interestadual</Label>
                <Input
                  id="cfop_interestadual"
                  value={formData.cfop_interestadual || ''}
                  onChange={(e) => handleChange('cfop_interestadual', e.target.value)}
                  placeholder="6102"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="csosn_padrao">CSOSN Padrão</Label>
                <Input
                  id="csosn_padrao"
                  value={formData.csosn_padrao || ''}
                  onChange={(e) => handleChange('csosn_padrao', e.target.value)}
                  placeholder="102, 500, etc."
                />
                <p className="text-xs text-muted-foreground">Para Simples Nacional</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cst_padrao">CST Padrão</Label>
                <Input
                  id="cst_padrao"
                  value={formData.cst_padrao || ''}
                  onChange={(e) => handleChange('cst_padrao', e.target.value)}
                  placeholder="00, 10, etc."
                />
                <p className="text-xs text-muted-foreground">Para Regime Normal</p>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="serie_nfe">Série NF-e</Label>
                <Input
                  id="serie_nfe"
                  type="number"
                  min={1}
                  value={formData.serie_nfe || 1}
                  onChange={(e) => handleChange('serie_nfe', parseInt(e.target.value) || 1)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="numero_nfe_atual">Próximo Número</Label>
                <Input
                  id="numero_nfe_atual"
                  type="number"
                  min={1}
                  value={formData.numero_nfe_atual || 1}
                  onChange={(e) => handleChange('numero_nfe_atual', parseInt(e.target.value) || 1)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Provedor e Automação */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              Provedor Fiscal
            </CardTitle>
            <CardDescription>Integração com o emissor de NF-e</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="provider">Provedor</Label>
              <Select
                value={formData.provider || 'focusnfe'}
                onValueChange={(v) => handleChange('provider', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="focusnfe">Focus NFe</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="provider_token">Token de API *</Label>
              <Input
                id="provider_token"
                type="password"
                value={formData.provider_token || ''}
                onChange={(e) => handleChange('provider_token', e.target.value)}
                placeholder="Token do provedor fiscal"
              />
              <p className="text-xs text-muted-foreground">
                Obtenha em <a href="https://focusnfe.com.br" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">focusnfe.com.br</a>
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ambiente">Ambiente *</Label>
              <Select
                value={formData.ambiente || 'homologacao'}
                onValueChange={(v) => handleChange('ambiente', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AMBIENTE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formData.ambiente === 'homologacao' && (
                <p className="text-xs text-amber-600">
                  Notas em homologação não têm valor fiscal.
                </p>
              )}
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="emissao_automatica" className="flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    Emissão Automática
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Emitir NF-e automaticamente quando o pedido mudar de status
                  </p>
                </div>
                <Switch
                  id="emissao_automatica"
                  checked={formData.emissao_automatica || false}
                  onCheckedChange={(checked) => handleChange('emissao_automatica', checked)}
                />
              </div>

              {formData.emissao_automatica && (
                <div className="space-y-2">
                  <Label htmlFor="emitir_apos_status">Emitir quando</Label>
                  <Select
                    value={formData.emitir_apos_status || 'paid'}
                    onValueChange={(v) => handleChange('emitir_apos_status', v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EMIT_STATUS_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
