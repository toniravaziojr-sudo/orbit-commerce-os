// =============================================
// EMITENTE SETTINGS — Tab "Configurações Fiscais"
// Reorganizado (rev UX 2026-05): Cartão de Prontidão no topo, Identidade unificada,
// Certificado em destaque com estados explícitos, Parâmetros, Ambiente, Salvar fixo.
// =============================================
import { useState, useEffect, useRef, useMemo } from 'react';
import { formatDateBR } from '@/lib/date-format';
import {
  Save, Building2, MapPin, FileText, Loader2, CheckCircle2, AlertCircle,
  Upload, ShieldCheck, ShieldAlert, ShieldX, Key, Trash2, Eye, EyeOff,
  CircleDashed, ArrowRight, Globe, Wand2, RefreshCw,
} from 'lucide-react';
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
import { cn } from '@/lib/utils';
import { useFiscalReadiness, readinessHeadline, FISCAL_READINESS_QUERY_KEY } from '@/hooks/useFiscalReadiness';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const UF_OPTIONS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
const CRT_OPTIONS = [
  { value: '1', label: '1 - Simples Nacional' },
  { value: '2', label: '2 - Simples Nacional (excesso de sublimite)' },
  { value: '3', label: '3 - Regime Normal (Lucro Presumido/Real)' },
  { value: '4', label: '4 - Simples Nacional - MEI (Microempreendedor Individual)' },
];
// Ambiente fixo em produção — sistema operando em ambiente fiscal real.

function formatCNPJ(value: string) {
  const numbers = value.replace(/\D/g, '').slice(0, 14);
  return numbers.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2}).*/, '$1.$2.$3/$4-$5');
}
function formatCNPJStrict(value: string) {
  const n = (value || '').replace(/\D/g, '');
  return n.length === 14 ? n.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : value || '';
}
function formatCEP(value: string) {
  const numbers = value.replace(/\D/g, '').slice(0, 8);
  return numbers.replace(/^(\d{5})(\d{3}).*/, '$1-$2');
}
function formatPhone(value: string) {
  const n = (value || '').replace(/\D/g, '').slice(0, 11);
  if (n.length <= 10) return n.replace(/^(\d{0,2})(\d{0,4})(\d{0,4}).*/, (_, a, b, c) => [a && `(${a}`, a && a.length === 2 ? ') ' : '', b, c && `-${c}`].filter(Boolean).join('').trim());
  return n.replace(/^(\d{2})(\d{5})(\d{4}).*/, '($1) $2-$3');
}
function isValidEmailStr(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((v || '').trim());
}

// (ChecklistItem removido — verdict de prontidão vem do backend)


export function EmitenteSettings() {
  const { settings, isLoading, saveSettings, uploadCertificate, removeCertificate } = useFiscalSettings();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<Partial<FiscalSettings>>({
    razao_social: '', nome_fantasia: '', cnpj: '', inscricao_estadual: '', ie_isento: false, cnae: '',
    endereco_logradouro: '', endereco_numero: '', endereco_complemento: '', endereco_bairro: '',
    endereco_municipio: '', endereco_municipio_codigo: '', endereco_uf: '', endereco_cep: '',
    email: '', telefone: '',
    crt: 1, cfop_intrastadual: '5102', cfop_interestadual: '6102', csosn_padrao: '', cst_padrao: '',
    serie_nfe: 1, numero_nfe_atual: 1, ambiente: 'producao', origem_fiscal_padrao: 0,
  });
  const [certPassword, setCertPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showReplaceForm, setShowReplaceForm] = useState(false);
  const [recentlyUploaded, setRecentlyUploaded] = useState(false);

  useEffect(() => {
    if (settings) setFormData({ ...settings, crt: settings.crt || 1 });
  }, [settings]);

  // Auto-hide success banner after 8s
  useEffect(() => {
    if (!recentlyUploaded) return;
    const t = setTimeout(() => setRecentlyUploaded(false), 8000);
    return () => clearTimeout(t);
  }, [recentlyUploaded]);

  const handleChange = (field: keyof FiscalSettings, value: any) => {
    setFormData(prev => {
      const next: any = { ...prev, [field]: value };
      // Auto-sincroniza regime_tributario quando o CRT muda
      if (field === 'crt') {
        if (value === 4) next.regime_tributario = 'mei';
        else if (value === 1 || value === 2) next.regime_tributario = 'simples_nacional';
        else if (value === 3 && (prev.regime_tributario === 'simples_nacional' || prev.regime_tributario === 'mei')) {
          next.regime_tributario = 'lucro_presumido';
        }
      }
      return next;
    });
  };

  const isDirty = useMemo(() => {
    if (!settings) return false;
    return JSON.stringify({ ...settings, crt: settings.crt || 1 }) !== JSON.stringify(formData);
  }, [settings, formData]);

  const handleSave = () => {
    if (!formData.razao_social?.trim()) { toast.error('Razão Social é obrigatória'); return; }
    if (!formData.cnpj || formData.cnpj.replace(/\D/g, '').length !== 14) { toast.error('CNPJ inválido'); return; }
    if (!formData.ie_isento && !formData.inscricao_estadual?.trim()) {
      toast.error('Inscrição Estadual é obrigatória (ou marque como Isento)'); return;
    }
    if (formData.email && !isValidEmailStr(formData.email)) {
      toast.error('E-mail do emitente inválido'); return;
    }
    saveSettings.mutate(formData);
  };

  const handleDiscard = () => {
    if (settings) setFormData({ ...settings, crt: settings.crt || 1 });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.toLowerCase().endsWith('.pfx')) { toast.error('Selecione um arquivo .pfx'); return; }
      setSelectedFile(file);
    }
  };

  const handleUploadCertificate = async () => {
    if (!selectedFile) { toast.error('Selecione um arquivo de certificado'); return; }
    if (!certPassword) { toast.error('Digite a senha do certificado'); return; }
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1];
      uploadCertificate.mutate({ pfxBase64: base64, password: certPassword }, {
        onSuccess: () => {
          setSelectedFile(null); setCertPassword(''); setShowPassword(false);
          setShowReplaceForm(false); setRecentlyUploaded(true);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      });
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleApplyCertCnpj = () => {
    const certCnpj = (settings?.certificado_cnpj || '').replace(/\D/g, '');
    if (certCnpj.length !== 14) return;
    handleChange('cnpj', formatCNPJ(certCnpj));
    toast.success('CNPJ do emitente atualizado. Revise Razão Social, IE e endereço e clique em Salvar.');
  };

  const hasCertificate = !!settings?.certificado_cn;
  const certValidUntil = settings?.certificado_valido_ate ? new Date(settings.certificado_valido_ate) : null;
  const now = new Date();
  const daysUntilExpiry = certValidUntil ? Math.floor((certValidUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 0;
  const isExpired = certValidUntil ? certValidUntil < now : false;
  const isExpiringSoon = !isExpired && daysUntilExpiry <= 30;

  // Divergência CNPJ certificado x CNPJ emitente
  const cnpjEmitClean = (formData.cnpj || '').replace(/\D/g, '');
  const cnpjCertClean = (settings?.certificado_cnpj || '').replace(/\D/g, '');
  const cnpjMismatch = !!(hasCertificate && cnpjEmitClean.length === 14 && cnpjCertClean.length === 14 && cnpjEmitClean !== cnpjCertClean);

  // Checklist cadastral local removido — a prontidão agora vem da fonte única
  // (useFiscalReadiness). Mantemos apenas as flags abaixo para a UI do
  // certificado (banners de divergência, expiração).

  // FONTE ÚNICA DE READINESS — vinda do backend (fiscal-integration-validate).
  // É proibido criar verdict paralelo aqui. Não pode haver dois cards de
  // prontidão fiscal na tela.
  const readinessQuery = useFiscalReadiness();
  const readiness = readinessQuery.data;
  const overallStatus = readinessQuery.isLoading ? 'loading' : (readiness?.overall_status || 'config_pending');
  const headline = readinessHeadline(overallStatus as any, readiness?.ambiente);
  const nextActionKind = readiness?.next_action_kind || null;
  const showRetryButton = nextActionKind === 'retry' || !!readiness?.can_retry_activation;

  // Reprocessar configuração fiscal (sem emitir NF). Apenas re-executa a
  // validação que, internamente, dispara a preparação automática quando
  // necessário (cadastro da empresa, captura de credenciais, ativação de
  // recebimento de retornos).
  const qc = useQueryClient();
  const reprocessMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('fiscal-integration-validate', { body: {} });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      toast.success('Reprocessamento concluído.');
      qc.invalidateQueries({ queryKey: FISCAL_READINESS_QUERY_KEY });
      qc.invalidateQueries({ queryKey: ['fiscal-settings'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Não foi possível reprocessar agora.'),
  });

  // Mapa de cards do servidor → âncora local (apenas para itens que possuem
  // campo cadastral real para o usuário corrigir, indicado por card.goto=true).
  const SERVER_KEY_TO_ANCHOR: Record<string, string> = {
    settings: 'card-identidade',
    focus_company: 'card-identidade',
    certificate: 'card-certificado',
    environment: 'card-ambiente',
  };

  const scrollTo = (anchor: string) => {
    const el = document.getElementById(anchor);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6 pb-24">
      {/* ============ CARTÃO DE PRONTIDÃO (fonte única: readiness backend) ============ */}
      <Card className={cn(
        'border-2',
        headline.tone === 'ready' && 'border-green-500/50 bg-green-500/5',
        headline.tone === 'pending' && 'border-amber-500/50 bg-amber-500/5',
        headline.tone === 'blocked' && 'border-destructive/50 bg-destructive/5',
        headline.tone === 'loading' && 'border-border',
      )}>
        <CardHeader>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                {headline.tone === 'ready' && <ShieldCheck className="h-6 w-6 text-green-600" />}
                {headline.tone === 'pending' && <AlertCircle className="h-6 w-6 text-amber-600" />}
                {headline.tone === 'blocked' && <ShieldX className="h-6 w-6 text-destructive" />}
                {headline.tone === 'loading' && <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />}
                {headline.title}
              </CardTitle>
              <CardDescription className="mt-1">{headline.description}</CardDescription>
            </div>
            <Badge
              variant="outline"
              className={cn(
                'text-sm px-3 py-1',
                headline.tone === 'ready' && 'border-green-500 text-green-700 bg-green-50 dark:bg-green-950/30',
                headline.tone === 'pending' && 'border-amber-500 text-amber-700 bg-amber-50 dark:bg-amber-950/30',
                headline.tone === 'blocked' && 'border-destructive text-destructive bg-destructive/10',
              )}
            >
              {headline.badge}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {readinessQuery.isLoading && (
            <div className="text-sm text-muted-foreground">Carregando situação fiscal…</div>
          )}

          {/* Mensagem de ação principal — somente em estados não-OK. */}
          {!readinessQuery.isLoading && readiness?.next_action_label && headline.tone !== 'ready' && (
            <Alert className={cn(
              headline.tone === 'pending' && 'border-amber-500/50 bg-amber-500/5',
              headline.tone === 'blocked' && 'border-destructive/50 bg-destructive/5',
            )}>
              <AlertCircle className={cn(
                'h-4 w-4',
                headline.tone === 'pending' ? 'text-amber-600' : 'text-destructive',
              )} />
              <AlertDescription className="text-sm">{readiness.next_action_label}</AlertDescription>
            </Alert>
          )}

          {!readinessQuery.isLoading && (readiness?.cards || []).length > 0 && (
            <ul className="space-y-2">
              {(readiness?.cards || []).map(item => {
                const canGoto = !!item.goto && !!SERVER_KEY_TO_ANCHOR[item.key];
                const anchor = SERVER_KEY_TO_ANCHOR[item.key];
                const valueLabel = item.status_label
                  || (item.level === 'ok' ? 'OK'
                    : item.level === 'pending' ? 'Preparando'
                    : item.level === 'warn' ? 'Pendente'
                    : 'Erro');
                return (
                  <li key={item.key} className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {item.level === 'ok' && <CheckCircle2 className="h-5 w-5 text-green-600" />}
                      {item.level === 'pending' && <CircleDashed className="h-5 w-5 text-amber-600" />}
                      {item.level === 'warn' && <AlertCircle className="h-5 w-5 text-amber-600" />}
                      {item.level === 'error' && <AlertCircle className="h-5 w-5 text-destructive" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className={cn('text-sm font-medium', item.level === 'ok' && 'text-muted-foreground')}>
                          {item.title}
                        </span>
                        <div className="flex items-center gap-3">
                          <span className={cn(
                            'text-xs whitespace-nowrap',
                            item.level === 'ok' && 'text-green-700 dark:text-green-400',
                            item.level === 'pending' && 'text-amber-700 dark:text-amber-400',
                            item.level === 'warn' && 'text-amber-700 dark:text-amber-400',
                            item.level === 'error' && 'text-destructive',
                          )}>
                            {valueLabel}
                          </span>
                          {canGoto && (
                            <button
                              type="button" onClick={() => scrollTo(anchor)}
                              className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                            >
                              Ir para <ArrowRight className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>
                      {item.message && <p className="text-xs text-muted-foreground mt-0.5">{item.message}</p>}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {!readinessQuery.isLoading && (readiness?.cards || []).length === 0 && (
            <div className="text-sm text-muted-foreground">Sem itens para exibir.</div>
          )}

          {/* Botão de ação principal — só aparece quando há erro/pendência operacional
              que o sistema pode reprocessar (não pede para o usuário "validar"). */}
          {!readinessQuery.isLoading && showRetryButton && (
            <div className="pt-2">
              <Button
                onClick={() => reprocessMutation.mutate()}
                disabled={reprocessMutation.isPending || readinessQuery.isFetching}
                className="gap-2"
              >
                {reprocessMutation.isPending || readinessQuery.isFetching
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <RefreshCw className="h-4 w-4" />}
                Reprocessar configuração fiscal
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ============ IDENTIDADE DA EMPRESA (Dados + Endereço unificados) ============ */}
      <Card id="card-identidade">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" />Identidade da Empresa</CardTitle>
          <CardDescription>Dados cadastrais e endereço fiscal — devem coincidir com o certificado A1.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            {/* Dados */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Dados</h4>
              <div className="space-y-2">
                <Label htmlFor="razao_social">Razão Social *</Label>
                <Input id="razao_social" value={formData.razao_social || ''} onChange={(e) => handleChange('razao_social', e.target.value)} placeholder="Razão social completa" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nome_fantasia">Nome Fantasia</Label>
                <Input id="nome_fantasia" value={formData.nome_fantasia || ''} onChange={(e) => handleChange('nome_fantasia', e.target.value)} placeholder="Nome fantasia (opcional)" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cnpj">CNPJ *</Label>
                  <Input id="cnpj" value={formData.cnpj || ''} onChange={(e) => handleChange('cnpj', formatCNPJ(e.target.value))} placeholder="00.000.000/0000-00" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cnae">CNAE</Label>
                  <Input id="cnae" value={formData.cnae || ''} onChange={(e) => handleChange('cnae', e.target.value)} placeholder="0000-0/00" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="inscricao_estadual">Inscrição Estadual *</Label>
                  <div className="flex items-center gap-2">
                    <Switch id="ie_isento" checked={formData.ie_isento || false} onCheckedChange={(checked) => handleChange('ie_isento', checked)} />
                    <Label htmlFor="ie_isento" className="text-sm font-normal">Isento</Label>
                  </div>
                </div>
                <Input id="inscricao_estadual" value={formData.inscricao_estadual || ''} onChange={(e) => handleChange('inscricao_estadual', e.target.value)} placeholder="Inscrição Estadual" disabled={formData.ie_isento} />
              </div>
            </div>
            {/* Endereço */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <MapPin className="h-4 w-4" />Endereço fiscal
              </h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="endereco_logradouro">Logradouro *</Label>
                  <Input id="endereco_logradouro" value={formData.endereco_logradouro || ''} onChange={(e) => handleChange('endereco_logradouro', e.target.value)} placeholder="Rua, Avenida, etc." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endereco_numero">Número *</Label>
                  <Input id="endereco_numero" value={formData.endereco_numero || ''} onChange={(e) => handleChange('endereco_numero', e.target.value)} placeholder="Nº" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="endereco_complemento">Complemento</Label>
                  <Input id="endereco_complemento" value={formData.endereco_complemento || ''} onChange={(e) => handleChange('endereco_complemento', e.target.value)} placeholder="Sala, Andar, etc." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endereco_bairro">Bairro *</Label>
                  <Input id="endereco_bairro" value={formData.endereco_bairro || ''} onChange={(e) => handleChange('endereco_bairro', e.target.value)} placeholder="Bairro" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="endereco_municipio">Município *</Label>
                  <Input id="endereco_municipio" value={formData.endereco_municipio || ''} onChange={(e) => handleChange('endereco_municipio', e.target.value)} placeholder="Cidade" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endereco_uf">UF *</Label>
                  <Select value={formData.endereco_uf || ''} onValueChange={(v) => handleChange('endereco_uf', v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{UF_OPTIONS.map((uf) => (<SelectItem key={uf} value={uf}>{uf}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="endereco_cep">CEP *</Label>
                  <Input id="endereco_cep" value={formData.endereco_cep || ''} onChange={(e) => handleChange('endereco_cep', formatCEP(e.target.value))} placeholder="00000-000" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endereco_municipio_codigo">Código IBGE</Label>
                  <Input id="endereco_municipio_codigo" value={formData.endereco_municipio_codigo || ''} onChange={(e) => handleChange('endereco_municipio_codigo', e.target.value)} placeholder="Código IBGE (opcional)" />
                </div>
              </div>
            </div>
          </div>

          {/* Contato do emitente — usado pela Focus NFe (DANFE) */}
          <Separator className="my-6" />
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Contato do emitente</h4>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail do emitente</Label>
                <Input
                  id="email" type="email" inputMode="email" autoComplete="email"
                  value={formData.email || ''}
                  onChange={(e) => handleChange('email', e.target.value)}
                  placeholder="contato@suaempresa.com.br"
                />
                <p className="text-xs text-muted-foreground">
                  Usado pela Focus NFe como remetente do DANFE para o cliente. Recomendado.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="telefone">Telefone do emitente</Label>
                <Input
                  id="telefone" type="tel" inputMode="tel" autoComplete="tel"
                  value={formData.telefone || ''}
                  onChange={(e) => handleChange('telefone', formatPhone(e.target.value))}
                  placeholder="(11) 99999-9999"
                />
                <p className="text-xs text-muted-foreground">
                  Aparece impresso no DANFE. Opcional.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ============ CERTIFICADO DIGITAL A1 — DESTAQUE ============ */}
      <Card id="card-certificado" className={cn(
        'border-2',
        cnpjMismatch || isExpired ? 'border-destructive/60' : hasCertificate ? 'border-green-500/40' : 'border-primary/40',
      )}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" />Certificado Digital A1
          </CardTitle>
          <CardDescription>
            Certificado ICP-Brasil (.pfx) usado para assinar e transmitir as NF-e. Validado pelo Focus NFe.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {recentlyUploaded && (
            <Alert className="border-green-500 bg-green-500/10">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700 dark:text-green-400">
                Certificado validado pelo Focus NFe. Pronto para emitir NF-e.
              </AlertDescription>
            </Alert>
          )}

          {hasCertificate ? (
            <>
              {/* Resumo do certificado configurado */}
              <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/40 border">
                {isExpired ? <ShieldX className="h-10 w-10 text-destructive flex-shrink-0" />
                  : isExpiringSoon ? <ShieldAlert className="h-10 w-10 text-amber-500 flex-shrink-0" />
                  : <ShieldCheck className="h-10 w-10 text-green-500 flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">{settings?.certificado_cn}</span>
                    {isExpired
                      ? <Badge variant="destructive">Expirado</Badge>
                      : isExpiringSoon
                        ? <Badge variant="outline" className="border-amber-500 text-amber-600">Expira em {daysUntilExpiry} dias</Badge>
                        : <Badge variant="outline" className="border-green-500 text-green-600">Válido</Badge>}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1 space-y-0.5">
                    {settings?.certificado_cnpj && (<p>CNPJ: <span className="font-mono">{formatCNPJStrict(settings.certificado_cnpj)}</span></p>)}
                    {settings?.certificado_serial && (<p>Serial: <span className="font-mono text-xs">{settings.certificado_serial}</span></p>)}
                    <p>Válido até: {certValidUntil ? formatDateBR(certValidUntil) : '-'}</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => { if (confirm('Tem certeza que deseja remover o certificado digital? Você não poderá emitir NF-e até enviar um novo certificado.')) removeCertificate.mutate(); }}
                  disabled={removeCertificate.isPending} title="Remover certificado">
                  {removeCertificate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </Button>
              </div>

              {/* Banners de estado */}
              {(isExpired || isExpiringSoon) && (
                <Alert variant={isExpired ? 'destructive' : 'default'} className={!isExpired ? 'border-amber-500' : undefined}>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {isExpired
                      ? 'Seu certificado expirou. Envie um novo certificado para continuar emitindo NF-e.'
                      : `Seu certificado expira em ${daysUntilExpiry} dias. Providencie a renovação.`}
                  </AlertDescription>
                </Alert>
              )}

              {cnpjMismatch && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="space-y-3">
                    <div>
                      <strong>CNPJs não coincidem.</strong> O certificado pertence ao CNPJ <span className="font-mono">{formatCNPJStrict(cnpjCertClean)}</span>,
                      mas o emitente está cadastrado como <span className="font-mono">{formatCNPJStrict(cnpjEmitClean) || '—'}</span>. A emissão está bloqueada.
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="secondary" onClick={handleApplyCertCnpj} className="gap-2">
                        <Wand2 className="h-4 w-4" />
                        Atualizar CNPJ do emitente para {formatCNPJStrict(cnpjCertClean)}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setShowReplaceForm(true)}>
                        Enviar outro certificado
                      </Button>
                    </div>
                    <p className="text-xs">
                      Ao atualizar o CNPJ, revise também Razão Social, Inscrição Estadual e endereço para que coincidam com o certificado.
                    </p>
                  </AlertDescription>
                </Alert>
              )}

              {/* Botão substituir / formulário de substituição */}
              {!showReplaceForm ? (
                <Button variant="outline" size="sm" onClick={() => setShowReplaceForm(true)}>
                  <Upload className="h-4 w-4 mr-2" />
                  Substituir certificado
                </Button>
              ) : (
                <div className="space-y-4 p-4 border rounded-lg bg-muted/20">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm text-muted-foreground">
                      Substituir o certificado encerra o vínculo anterior no Focus NFe e cadastra a nova empresa automaticamente.
                    </p>
                    <Button variant="ghost" size="sm" onClick={() => { setShowReplaceForm(false); setSelectedFile(null); setCertPassword(''); }}>Cancelar</Button>
                  </div>
                  <CertificateUploadForm
                    fileInputRef={fileInputRef}
                    selectedFile={selectedFile}
                    onFileSelect={handleFileSelect}
                    certPassword={certPassword}
                    setCertPassword={setCertPassword}
                    showPassword={showPassword}
                    setShowPassword={setShowPassword}
                    onUpload={handleUploadCertificate}
                    isPending={uploadCertificate.isPending}
                    submitLabel="Substituir Certificado"
                  />
                </div>
              )}
            </>
          ) : (
            <>
              <div className="rounded-lg border-2 border-dashed border-muted-foreground/30 p-6 text-center bg-muted/20">
                <Key className="h-10 w-10 text-muted-foreground/60 mx-auto mb-3" />
                <h4 className="font-medium mb-1">Nenhum certificado configurado</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Envie seu certificado A1 (.pfx) e a senha. Validamos automaticamente com o Focus NFe.
                </p>
              </div>
              <CertificateUploadForm
                fileInputRef={fileInputRef}
                selectedFile={selectedFile}
                onFileSelect={handleFileSelect}
                certPassword={certPassword}
                setCertPassword={setCertPassword}
                showPassword={showPassword}
                setShowPassword={setShowPassword}
                onUpload={handleUploadCertificate}
                isPending={uploadCertificate.isPending}
                submitLabel="Enviar Certificado"
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* ============ PARÂMETROS FISCAIS ============ */}
      <Card id="card-parametros">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" />Parâmetros Fiscais</CardTitle>
          <CardDescription>Regime tributário, origem padrão, natureza padrão de venda e numeração da NF-e. O CFOP por item agora vem da Natureza de Operação vinculada à nota (intra/inter por UF).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="crt">Regime Tributário (CRT) *</Label>
              <Select value={String(formData.crt || 1)} onValueChange={(v) => handleChange('crt', parseInt(v))}>
                <SelectTrigger><SelectValue placeholder="Selecione o regime" /></SelectTrigger>
                <SelectContent>{CRT_OPTIONS.map((opt) => (<SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="origem_fiscal_padrao">Origem Fiscal Padrão *</Label>
              <Select value={String(formData.origem_fiscal_padrao ?? 0)} onValueChange={(v) => handleChange('origem_fiscal_padrao', parseInt(v))}>
                <SelectTrigger><SelectValue placeholder="Selecione a origem" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">0 - Nacional</SelectItem>
                  <SelectItem value="1">1 - Estrangeira (importação direta)</SelectItem>
                  <SelectItem value="2">2 - Estrangeira (adquirida no mercado interno)</SelectItem>
                  <SelectItem value="3">3 - Nacional com conteúdo importado &gt; 40%</SelectItem>
                  <SelectItem value="4">4 - Nacional (processos produtivos básicos)</SelectItem>
                  <SelectItem value="5">5 - Nacional com conteúdo importado ≤ 40%</SelectItem>
                  <SelectItem value="6">6 - Estrangeira (importação direta, sem similar nacional)</SelectItem>
                  <SelectItem value="7">7 - Estrangeira (adquirida internamente, sem similar nacional)</SelectItem>
                  <SelectItem value="8">8 - Nacional com conteúdo importado &gt; 70%</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Separator />
          <DefaultSalesNatureField
            value={(formData as any).default_sales_nature_id || ''}
            onChange={(v) => handleChange('default_sales_nature_id' as any, v || null)}
          />
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="csosn_padrao">CSOSN Padrão</Label>
              <Input id="csosn_padrao" value={formData.csosn_padrao || ''} onChange={(e) => handleChange('csosn_padrao', e.target.value)} placeholder="102, 500, etc." />
              <p className="text-xs text-muted-foreground">Para Simples Nacional</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cst_padrao">CST Padrão</Label>
              <Input id="cst_padrao" value={formData.cst_padrao || ''} onChange={(e) => handleChange('cst_padrao', e.target.value)} placeholder="00, 10, etc." />
              <p className="text-xs text-muted-foreground">Para Regime Normal</p>
            </div>
          </div>

          {/* ============ TRIBUTOS — Lucro Presumido / Lucro Real ============ */}
          {formData.crt === 3 && (
            <>
              <Separator />
              <div className="space-y-3">
                <div>
                  <h4 className="font-medium">Tributos PIS, COFINS e ICMS</h4>
                  <p className="text-xs text-muted-foreground">
                    Aplicados automaticamente nos itens das Notas Fiscais (Lucro Presumido/Real).
                    Cada produto pode sobrescrever em "Configurações Fiscais &gt; Produtos". Para Simples Nacional, deixe zerado.
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="regime_tributario">Regime</Label>
                    <Select
                      value={formData.regime_tributario || 'lucro_presumido'}
                      onValueChange={(v) => handleChange('regime_tributario', v)}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="lucro_presumido">Lucro Presumido</SelectItem>
                        <SelectItem value="lucro_real">Lucro Real</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pis_cst_padrao">CST PIS Padrão</Label>
                    <Input
                      id="pis_cst_padrao"
                      value={formData.pis_cst_padrao || ''}
                      onChange={(e) => handleChange('pis_cst_padrao', e.target.value)}
                      placeholder="01"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cofins_cst_padrao">CST COFINS Padrão</Label>
                    <Input
                      id="cofins_cst_padrao"
                      value={formData.cofins_cst_padrao || ''}
                      onChange={(e) => handleChange('cofins_cst_padrao', e.target.value)}
                      placeholder="01"
                    />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="pis_aliquota_padrao">Alíquota PIS (%)</Label>
                    <Input
                      id="pis_aliquota_padrao"
                      type="number"
                      step="0.0001"
                      min={0}
                      value={formData.pis_aliquota_padrao ?? 0}
                      onChange={(e) => handleChange('pis_aliquota_padrao', parseFloat(e.target.value) || 0)}
                      placeholder="1.65"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cofins_aliquota_padrao">Alíquota COFINS (%)</Label>
                    <Input
                      id="cofins_aliquota_padrao"
                      type="number"
                      step="0.0001"
                      min={0}
                      value={formData.cofins_aliquota_padrao ?? 0}
                      onChange={(e) => handleChange('cofins_aliquota_padrao', parseFloat(e.target.value) || 0)}
                      placeholder="7.60"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="icms_aliquota_padrao">Alíquota ICMS (%)</Label>
                    <Input
                      id="icms_aliquota_padrao"
                      type="number"
                      step="0.0001"
                      min={0}
                      value={formData.icms_aliquota_padrao ?? 0}
                      onChange={(e) => handleChange('icms_aliquota_padrao', parseFloat(e.target.value) || 0)}
                      placeholder="18.00"
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          <Separator />
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="serie_nfe">Série NF-e</Label>
              <Input id="serie_nfe" type="number" min={1} value={formData.serie_nfe || 1} onChange={(e) => handleChange('serie_nfe', parseInt(e.target.value) || 1)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="numero_nfe_atual">Próximo Número</Label>
              <Input id="numero_nfe_atual" type="number" min={1} value={formData.numero_nfe_atual || 1} onChange={(e) => handleChange('numero_nfe_atual', parseInt(e.target.value) || 1)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ============ AMBIENTE DE EMISSÃO — INFORMATIVO ============ */}
      <Card id="card-ambiente">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5" />Ambiente de Emissão</CardTitle>
          <CardDescription>Sua loja está emitindo notas fiscais com valor real.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Alert className="border-emerald-500 bg-emerald-500/10">
            <Globe className="h-4 w-4 text-emerald-600" />
            <AlertDescription className="text-emerald-700 dark:text-emerald-400">
              <strong>Produção ativa.</strong> Todas as notas fiscais emitidas têm valor fiscal real perante a SEFAZ.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* ============ BARRA FIXA DE SALVAR ============ */}
      {isDirty && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 shadow-lg">
          <div className="container max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
              <AlertCircle className="h-4 w-4" />
              Alterações não salvas
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={handleDiscard} disabled={saveSettings.isPending}>Descartar</Button>
              <Button onClick={handleSave} disabled={saveSettings.isPending}>
                {saveSettings.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Salvar alterações
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ===== Subcomponente: formulário de upload de certificado =====
function CertificateUploadForm(props: {
  fileInputRef: React.RefObject<HTMLInputElement>;
  selectedFile: File | null;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  certPassword: string;
  setCertPassword: (v: string) => void;
  showPassword: boolean;
  setShowPassword: (v: boolean) => void;
  onUpload: () => void;
  isPending: boolean;
  submitLabel: string;
}) {
  const { fileInputRef, selectedFile, onFileSelect, certPassword, setCertPassword,
    showPassword, setShowPassword, onUpload, isPending, submitLabel } = props;
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="certificate_file">Arquivo do Certificado (.pfx)</Label>
        <Input ref={fileInputRef} id="certificate_file" type="file" accept=".pfx" onChange={onFileSelect} className="cursor-pointer" />
        {selectedFile && (<p className="text-sm text-muted-foreground">Arquivo selecionado: {selectedFile.name}</p>)}
      </div>
      <div className="space-y-2">
        <Label htmlFor="cert_password">Senha do Certificado</Label>
        <div className="relative">
          <Input
            id="cert_password" type={showPassword ? 'text' : 'password'}
            value={certPassword} onChange={(e) => setCertPassword(e.target.value)}
            placeholder="Digite a senha do certificado" className="pr-10"
          />
          <button
            type="button" onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <Button onClick={onUpload} disabled={!selectedFile || !certPassword || isPending} className="w-full">
        {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
        {isPending ? 'Validando com Focus NFe…' : submitLabel}
      </Button>
    </div>
  );
}

// ============= Default Sales Nature Field =============
// Lista as Naturezas de Operação ativas do tenant e permite eleger a "padrão para vendas
// automáticas" (usada quando o pedido vira NF sem natureza explícita).
function DefaultSalesNatureField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [natures, setNatures] = useState<Array<{ id: string; nome: string; cfop_intra: string; cfop_inter: string }>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data: prof } = await supabase.from('profiles').select('current_tenant_id').eq('id', user.id).maybeSingle();
      const tenantId = (prof as any)?.current_tenant_id;
      if (!tenantId) { setLoading(false); return; }
      const { data } = await supabase
        .from('fiscal_operation_natures')
        .select('id, nome, cfop_intra, cfop_inter')
        .eq('tenant_id', tenantId)
        .eq('ativo', true)
        .eq('tipo_documento', 1)
        .order('nome');
      if (!cancelled) {
        setNatures((data as any) || []);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="space-y-2">
      <Label>Natureza padrão para vendas automáticas</Label>
      <Select value={value || '__none__'} onValueChange={(v) => onChange(v === '__none__' ? '' : v)} disabled={loading}>
        <SelectTrigger>
          <SelectValue placeholder={loading ? 'Carregando…' : 'Selecione a natureza padrão'} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">— Não definida —</SelectItem>
          {natures.map(n => (
            <SelectItem key={n.id} value={n.id}>
              {n.nome} <span className="text-muted-foreground text-xs ml-1">({n.cfop_intra}/{n.cfop_inter})</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        Usada quando um pedido vira NF automaticamente. O CFOP de cada item é decidido pela natureza + UF do destinatário (intra 5xxx / inter 6xxx). Edição manual por item continua possível na nota.
      </p>
    </div>
  );
}
