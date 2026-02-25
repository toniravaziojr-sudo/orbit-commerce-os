import { useState, useEffect, useRef } from 'react';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Building2, MapPin, FileText, Settings2, Zap, Loader2, CheckCircle, AlertCircle, Upload, ShieldCheck, ShieldAlert, ShieldX, Key, Package, Trash2, Truck, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
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

// Shipping provider options
const SHIPPING_PROVIDER_OPTIONS = [
  { value: 'correios', label: 'Correios' },
  { value: 'loggi', label: 'Loggi' },
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
  const { settings, isLoading, saveSettings, uploadCertificate, removeCertificate } = useFiscalSettings();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { confirm: confirmAction, ConfirmDialog: FiscalConfirmDialog } = useConfirmDialog();
  
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
    ambiente: 'homologacao',
    emissao_automatica: false,
    emitir_apos_status: 'paid',
    auto_create_shipment: false,
    auto_update_order_status: true,
    default_shipping_provider: null,
    enviar_email_nfe: true,
    email_nfe_subject: '',
    email_nfe_body: '',
    desmembrar_estrutura: false,
  });

  const [certPassword, setCertPassword] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.toLowerCase().endsWith('.pfx')) {
        toast.error('Selecione um arquivo .pfx');
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUploadCertificate = async () => {
    if (!selectedFile) {
      toast.error('Selecione um arquivo de certificado');
      return;
    }
    if (!certPassword) {
      toast.error('Digite a senha do certificado');
      return;
    }

    // Read file as base64
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1];
      uploadCertificate.mutate({ pfxBase64: base64, password: certPassword }, {
        onSuccess: () => {
          setSelectedFile(null);
          setCertPassword('');
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        }
      });
    };
    reader.readAsDataURL(selectedFile);
  };

  // Certificate status helpers
  const hasCertificate = !!settings?.certificado_cn;
  const certValidUntil = settings?.certificado_valido_ate ? new Date(settings.certificado_valido_ate) : null;
  const now = new Date();
  const daysUntilExpiry = certValidUntil ? Math.floor((certValidUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 0;
  const isExpired = certValidUntil ? certValidUntil < now : false;
  const isExpiringSoon = !isExpired && daysUntilExpiry <= 30;

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
          <Button variant="ghost" size="icon" onClick={() => navigate('/fiscal')}>
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

      {/* Quick Actions Card */}
      <Card className="border-secondary/20 bg-secondary/5">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary/10">
              <FileText className="h-6 w-6 text-secondary-foreground" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">Naturezas de Operação</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Cadastre naturezas para diferentes tipos de NF-e.
              </p>
            </div>
            <Button variant="outline" onClick={() => navigate('/fiscal/operation-natures')}>
              Gerenciar
            </Button>
          </div>
        </CardContent>
      </Card>

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

        {/* Certificado Digital A1 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Certificado Digital A1
            </CardTitle>
            <CardDescription>Certificado ICP-Brasil para emissão de NF-e</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Certificate Status */}
            {hasCertificate ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                  {isExpired ? (
                    <ShieldX className="h-8 w-8 text-destructive flex-shrink-0" />
                  ) : isExpiringSoon ? (
                    <ShieldAlert className="h-8 w-8 text-amber-500 flex-shrink-0" />
                  ) : (
                    <ShieldCheck className="h-8 w-8 text-green-500 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{settings?.certificado_cn}</span>
                      {isExpired ? (
                        <Badge variant="destructive">Expirado</Badge>
                      ) : isExpiringSoon ? (
                        <Badge variant="outline" className="border-amber-500 text-amber-600">
                          Expira em {daysUntilExpiry} dias
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-green-500 text-green-600">Válido</Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1 space-y-0.5">
                      {settings?.certificado_cnpj && (
                        <p>CNPJ: {settings.certificado_cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')}</p>
                      )}
                      <p>Serial: {settings?.certificado_serial}</p>
                      <p>Válido até: {certValidUntil?.toLocaleDateString('pt-BR')}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={async () => {
                      const ok = await confirmAction({
                        title: "Remover certificado digital",
                        description: "Tem certeza que deseja remover o certificado digital? Você não poderá emitir NF-e até enviar um novo certificado.",
                        confirmLabel: "Remover",
                        variant: "warning",
                      });
                      if (ok) {
                        removeCertificate.mutate();
                      }
                    }}
                    disabled={removeCertificate.isPending}
                    title="Remover certificado"
                  >
                    {removeCertificate.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                {(isExpired || isExpiringSoon) && (
                  <Alert variant={isExpired ? "destructive" : "default"} className={!isExpired ? "border-amber-500" : undefined}>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      {isExpired 
                        ? 'Seu certificado expirou. Faça o upload de um novo certificado para continuar emitindo NF-e.'
                        : `Seu certificado expira em ${daysUntilExpiry} dias. Providencie a renovação.`
                      }
                    </AlertDescription>
                  </Alert>
                )}

                <Separator />
                <p className="text-sm text-muted-foreground">Substituir certificado:</p>
              </div>
            ) : (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Nenhum certificado configurado. Faça o upload do seu certificado A1 (.pfx) para emitir NF-e.
                </AlertDescription>
              </Alert>
            )}

            {/* Upload Form */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="certificate_file">Arquivo do Certificado (.pfx)</Label>
                <Input
                  ref={fileInputRef}
                  id="certificate_file"
                  type="file"
                  accept=".pfx"
                  onChange={handleFileSelect}
                  className="cursor-pointer"
                />
                {selectedFile && (
                  <p className="text-sm text-muted-foreground">
                    Arquivo selecionado: {selectedFile.name}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="cert_password">Senha do Certificado</Label>
                <Input
                  id="cert_password"
                  type="password"
                  value={certPassword}
                  onChange={(e) => setCertPassword(e.target.value)}
                  placeholder="Digite a senha do certificado"
                />
              </div>

              <Button 
                onClick={handleUploadCertificate} 
                disabled={!selectedFile || !certPassword || uploadCertificate.isPending}
                className="w-full"
              >
                {uploadCertificate.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                {hasCertificate ? 'Substituir Certificado' : 'Enviar Certificado'}
              </Button>
            </div>

            <Separator />

            {/* Ambiente */}
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

            {/* Automação */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="emissao_automatica" className="flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    Emissão Automática de NF-e
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
                  <Label htmlFor="emitir_apos_status">Emitir NF-e quando</Label>
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

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="enviar_email_nfe" className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Enviar Email com NF-e ao Cliente
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Enviar email automático com DANFE e XML quando NF-e for autorizada
                  </p>
                </div>
                <Switch
                  id="enviar_email_nfe"
                  checked={formData.enviar_email_nfe !== false}
                  onCheckedChange={(checked) => handleChange('enviar_email_nfe', checked)}
                />
              </div>

              {formData.enviar_email_nfe !== false && (
                <div className="space-y-4 p-4 rounded-lg bg-muted/30 border">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    Personalizar Email da NF-e
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="email_nfe_subject">Assunto do Email</Label>
                    <Input
                      id="email_nfe_subject"
                      value={formData.email_nfe_subject || ''}
                      onChange={(e) => handleChange('email_nfe_subject', e.target.value)}
                      placeholder="Sua Nota Fiscal - Pedido {{order_number}}"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email_nfe_body">Conteúdo do Email</Label>
                    <textarea
                      id="email_nfe_body"
                      className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      value={formData.email_nfe_body || ''}
                      onChange={(e) => handleChange('email_nfe_body', e.target.value)}
                      placeholder={`Olá {{customer_name}},

Segue anexo a Nota Fiscal referente ao seu pedido {{order_number}}.

Número da NF-e: {{nfe_number}}
Série: {{nfe_serie}}
Data de Emissão: {{data_emissao}}
Valor Total: {{valor_total}}

Você pode acessar os documentos nos links abaixo:
- DANFE: {{danfe_url}}
- XML: {{xml_url}}

Obrigado pela preferência!
{{store_name}}`}
                    />
                    <p className="text-xs text-muted-foreground">
                      Deixe em branco para usar o template padrão do sistema
                    </p>
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
                        <Badge 
                          key={variable.key} 
                          variant="secondary" 
                          className="cursor-pointer hover:bg-secondary/80 text-xs"
                          onClick={() => {
                            navigator.clipboard.writeText(variable.key);
                            toast.success(`${variable.key} copiado!`);
                          }}
                          title={`Clique para copiar: ${variable.label}`}
                        >
                          {variable.key}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="auto_create_shipment" className="flex items-center gap-2">
                    <Truck className="h-4 w-4" />
                    Criar Remessa Automaticamente
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Gerar código de rastreio na transportadora após NF-e autorizada
                  </p>
                </div>
                <Switch
                  id="auto_create_shipment"
                  checked={formData.auto_create_shipment || false}
                  onCheckedChange={(checked) => handleChange('auto_create_shipment', checked)}
                />
              </div>

              {formData.auto_create_shipment && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="default_shipping_provider">Transportadora Padrão</Label>
                    <Select
                      value={formData.default_shipping_provider || ''}
                      onValueChange={(v) => handleChange('default_shipping_provider', v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Usar transportadora do pedido" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Usar transportadora do pedido</SelectItem>
                        {SHIPPING_PROVIDER_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      A transportadora deve estar configurada em Integrações
                    </p>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="auto_update_order_status">Atualizar Status do Pedido</Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Marcar pedido como "Etiqueta Criada" após gerar remessa
                      </p>
                    </div>
                    <Switch
                      id="auto_update_order_status"
                      checked={formData.auto_update_order_status !== false}
                      onCheckedChange={(checked) => handleChange('auto_update_order_status', checked)}
                    />
                  </div>
                </>
              )}

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="desmembrar_estrutura" className="flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Desmembrar Estrutura do Produto na NF-e
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Produtos com composição (kits) serão desmembrados em seus componentes na NF-e
                  </p>
                </div>
                <Switch
                  id="desmembrar_estrutura"
                  checked={formData.desmembrar_estrutura || false}
                  onCheckedChange={(checked) => handleChange('desmembrar_estrutura', checked)}
                />
              </div>
              {formData.desmembrar_estrutura && (
                <div className="p-3 bg-muted/50 rounded-lg border text-sm">
                  <p className="font-medium mb-1">Exemplo:</p>
                  <p className="text-muted-foreground">
                    Um "Kit 2x Shampoo + 2x Suplemento" aparecerá na NF-e como:
                  </p>
                  <ul className="list-disc list-inside text-muted-foreground mt-1">
                    <li>Item 1: Shampoo (Qtde: 2)</li>
                    <li>Item 2: Suplemento (Qtde: 2)</li>
                  </ul>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      {FiscalConfirmDialog}
    </div>
  );
}
