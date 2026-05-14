// =============================================
// FOCUS NFE INTEGRATION TAB — Lote 1.E (Parte 2)
// Aba dedicada em Configurações Fiscais.
//
// Mostra cards de saúde (Empresa Focus, Certificado, Webhook, Ambiente),
// botões Validar / Cadastrar webhook automaticamente, e fallback manual
// (URL com token por loja) APENAS quando o cadastro automático falha.
//
// Regras de segurança da UI:
// - Nunca expor o secret global FOCUS_NFE_WEBHOOK_SECRET.
// - Nunca expor PFX, senha do certificado, token Focus NFe.
// - Token por loja aparece SOMENTE no fallback manual, mascarado por padrão,
//   com ação explícita de revelar/copiar (apenas owner/admin).
// - operator: hook `useTenantAccess` impede acesso à página de Configurações.
// =============================================
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Loader2, ShieldCheck, ShieldAlert, ShieldX, CheckCircle2, AlertCircle,
  Clock, Webhook, Building2, KeyRound, Globe, RefreshCw, PlugZap,
  Copy, Eye, EyeOff,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDateBR } from '@/lib/date-format';

type CardLevel = 'ok' | 'warn' | 'error' | 'pending';
interface ValidationCard {
  key: string;
  level: CardLevel;
  title: string;
  message: string;
  details?: Record<string, any>;
}

interface ValidateResponse {
  success: boolean;
  ambiente?: 'homologacao' | 'producao';
  ready_for_production?: boolean;
  ready_for_homologation_smoke?: boolean;
  cards?: ValidationCard[];
  error?: string;
}

interface RegisterResponse {
  success: boolean;
  auto_register_succeeded?: boolean;
  fallback?: boolean;
  ambiente?: string;
  webhook_url_sanitized?: string;
  manual_register_url?: string; // contém token por loja
  manual_register_event?: string;
  manual_register_cnpj?: string;
  focus_hook_id?: string;
  status?: string;
  error?: string;
  code?: string;
}

const ICONS: Record<string, any> = {
  focus_company: Building2,
  certificate: KeyRound,
  webhook: Webhook,
  environment: Globe,
};

function levelBadge(level: CardLevel) {
  if (level === 'ok') return <Badge variant="outline" className="border-green-500/50 text-green-600">OK</Badge>;
  if (level === 'pending') return <Badge variant="outline" className="border-amber-500/50 text-amber-600">Aguardando</Badge>;
  if (level === 'warn') return <Badge variant="outline" className="border-amber-500/50 text-amber-600">Atenção</Badge>;
  return <Badge variant="destructive">Bloqueio</Badge>;
}
function levelIcon(level: CardLevel) {
  if (level === 'ok') return <CheckCircle2 className="h-5 w-5 text-green-600" />;
  if (level === 'pending') return <Clock className="h-5 w-5 text-amber-600" />;
  if (level === 'warn') return <AlertCircle className="h-5 w-5 text-amber-600" />;
  return <ShieldX className="h-5 w-5 text-destructive" />;
}

export function FocusIntegrationSettings() {
  const qc = useQueryClient();
  const [fallback, setFallback] = useState<RegisterResponse | null>(null);
  const [showToken, setShowToken] = useState(false);

  const validateQuery = useQuery({
    queryKey: ['fiscal-integration-validate'],
    queryFn: async (): Promise<ValidateResponse> => {
      const { data, error } = await supabase.functions.invoke('fiscal-integration-validate', {
        body: {},
      });
      if (error) throw new Error(error.message);
      return data as ValidateResponse;
    },
    staleTime: 30_000,
  });

  const registerMutation = useMutation({
    mutationFn: async (opts: { dry_run?: boolean; rotate_token?: boolean } = {}) => {
      const { data, error } = await supabase.functions.invoke('fiscal-webhook-register', {
        body: opts,
      });
      if (error) throw new Error(error.message);
      return data as RegisterResponse;
    },
    onSuccess: (data) => {
      if (!data.success) {
        toast.error(data.error || 'Falha ao cadastrar webhook');
        return;
      }
      if (data.auto_register_succeeded) {
        toast.success('Notificações fiscais cadastradas. Aguardando primeira confirmação automática.');
        setFallback(null);
        setShowToken(false);
      } else if (data.fallback) {
        toast.warning('Cadastro automático falhou — use o fallback manual abaixo.');
        setFallback(data);
      }
      qc.invalidateQueries({ queryKey: ['fiscal-integration-validate'] });
      qc.invalidateQueries({ queryKey: ['fiscal-settings'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao cadastrar webhook'),
  });

  const cards = validateQuery.data?.cards || [];
  const ambiente = validateQuery.data?.ambiente;
  const readyProd = !!validateQuery.data?.ready_for_production;
  const readySmoke = !!validateQuery.data?.ready_for_homologation_smoke;

  const webhookCard = cards.find(c => c.key === 'webhook');
  const webhookDetails = webhookCard?.details || {};

  const maskedToken = (() => {
    if (!fallback?.manual_register_url) return null;
    try {
      const u = new URL(fallback.manual_register_url);
      const token = u.searchParams.get('t') || '';
      if (showToken) return token;
      return token ? `${token.slice(0, 6)}••••••••${token.slice(-4)}` : null;
    } catch { return null; }
  })();

  const copyManualUrl = async () => {
    if (!fallback?.manual_register_url) return;
    await navigator.clipboard.writeText(fallback.manual_register_url);
    toast.success('URL copiada. Trate como credencial sensível desta loja.');
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho da seção */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2">
                <PlugZap className="h-5 w-5" />
                Validação Fiscal
              </CardTitle>
              <CardDescription>
                Verifique se sua loja está pronta para emitir notas fiscais: dados do emitente,
                certificado digital, ambiente e recebimento automático de retornos.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => validateQuery.refetch()}
                disabled={validateQuery.isFetching}
                className="gap-2"
              >
                {validateQuery.isFetching
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <RefreshCw className="h-4 w-4" />}
                Validar integração fiscal
              </Button>
              <Button
                size="sm"
                onClick={() => registerMutation.mutate({})}
                disabled={registerMutation.isPending}
                className="gap-2"
              >
                {registerMutation.isPending
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Webhook className="h-4 w-4" />}
                Ativar recebimento automático de retornos
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status global */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="gap-1">
              <Globe className="h-3 w-3" /> Ambiente: {ambiente === 'producao' ? 'Produção' : ambiente === 'homologacao' ? 'Homologação' : '—'}
            </Badge>
            {readyProd
              ? <Badge variant="outline" className="border-green-500/50 text-green-600 gap-1"><ShieldCheck className="h-3 w-3" /> Pronto para produção</Badge>
              : <Badge variant="outline" className="gap-1"><ShieldAlert className="h-3 w-3" /> Não pronto para produção</Badge>}
            {readySmoke && <Badge variant="outline" className="border-amber-500/50 text-amber-600">Pronto para smoke test em homologação</Badge>}
          </div>

          {validateQuery.isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {validateQuery.isError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Não foi possível validar a integração: {(validateQuery.error as any)?.message || 'erro desconhecido'}
              </AlertDescription>
            </Alert>
          )}

          {/* Cards 4-em-1 */}
          <div className="grid gap-3 md:grid-cols-2">
            {cards.map((c) => {
              const Icon = ICONS[c.key] || ShieldCheck;
              return (
                <Card key={c.key} className="border">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Icon className="h-5 w-5 text-muted-foreground" />
                        <CardTitle className="text-base">{c.title}</CardTitle>
                      </div>
                      <div className="flex items-center gap-2">
                        {levelIcon(c.level)}
                        {levelBadge(c.level)}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground space-y-1">
                    <p>{c.message}</p>
                    {c.key === 'webhook' && (
                      <div className="text-xs space-y-0.5 pt-2">
                        {webhookDetails.url && (
                          <div className="font-mono break-all">URL: {webhookDetails.url}</div>
                        )}
                        {webhookDetails.environment && (
                          <div>Ambiente cadastrado: {webhookDetails.environment}</div>
                        )}
                        {webhookDetails.registered_at && (
                          <div>Cadastrado em: {formatDateBR(webhookDetails.registered_at)}</div>
                        )}
                        {webhookDetails.validated_at && (
                          <div>Validado em: {formatDateBR(webhookDetails.validated_at)}</div>
                        )}
                        {webhookDetails.last_received_at && (
                          <div>Última chamada: {formatDateBR(webhookDetails.last_received_at)}</div>
                        )}
                        {webhookDetails.last_error && (
                          <div className="text-destructive">Último erro: {webhookDetails.last_error}</div>
                        )}
                      </div>
                    )}
                    {c.key === 'certificate' && c.details?.valid_until && (
                      <div className="text-xs pt-2">Válido até {formatDateBR(c.details.valid_until)}</div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Fallback manual seguro (somente quando cadastro automático falhar) */}
      {fallback && fallback.fallback && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <AlertCircle className="h-5 w-5" />
              Fallback manual — credencial sensível desta loja
            </CardTitle>
            <CardDescription>
              O cadastro automático falhou. Cadastre o webhook diretamente no painel da Focus NFe usando a URL abaixo.
              <strong className="block mt-1">
                A URL contém um token por loja. Trate como credencial: não compartilhe, não exiba em telas públicas, não envie por canais inseguros.
              </strong>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm space-y-1">
              <div><strong>CNPJ:</strong> {fallback.manual_register_cnpj}</div>
              <div><strong>Evento:</strong> {fallback.manual_register_event}</div>
              <div><strong>Ambiente:</strong> {fallback.ambiente}</div>
              <div><strong>URL pública (sem token):</strong> <span className="font-mono text-xs break-all">{fallback.webhook_url_sanitized}</span></div>
            </div>
            <Separator />
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">Token por loja (sensível):</div>
              <div className="flex items-center gap-2 flex-wrap">
                <code className="font-mono text-xs px-2 py-1 rounded bg-muted break-all">{maskedToken || '—'}</code>
                <Button size="sm" variant="ghost" onClick={() => setShowToken(s => !s)} className="gap-1">
                  {showToken ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  {showToken ? 'Ocultar' : 'Revelar'}
                </Button>
                <Button size="sm" variant="outline" onClick={copyManualUrl} className="gap-1">
                  <Copy className="h-3 w-3" /> Copiar URL completa
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => registerMutation.mutate({ rotate_token: true })}
                  disabled={registerMutation.isPending}
                  className="gap-1"
                >
                  <RefreshCw className="h-3 w-3" /> Rotacionar token
                </Button>
              </div>
            </div>
            {fallback.error && (
              <Alert variant="destructive">
                <AlertDescription className="text-xs">{fallback.error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
