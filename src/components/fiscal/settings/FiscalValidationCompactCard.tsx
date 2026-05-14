// =============================================
// FISCAL VALIDATION — Card compacto
// Mora dentro da aba "Configurações Fiscais", ao lado do "Ambiente de Emissão".
//
// Regras (v2):
// - O recebimento automático de retornos é ativado automaticamente pelo backend
//   quando todos os pré-requisitos estiverem completos. O usuário não precisa
//   clicar em nenhum botão obrigatório.
// - O botão "Tentar novamente" só aparece quando há erro real ou fallback manual.
// - O selo geral reflete o ambiente: "Pronto para teste" em homologação,
//   "Pronto" em produção, "Configuração pendente", "Erro" ou "Bloqueado".
// =============================================
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Loader2, ShieldCheck, ShieldAlert, ShieldX, CheckCircle2, AlertCircle,
  Clock, RefreshCw, PlugZap, Copy, Eye, EyeOff, FlaskConical,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useFiscalReadiness, FISCAL_READINESS_QUERY_KEY } from '@/hooks/useFiscalReadiness';

type CardLevel = 'ok' | 'warn' | 'error' | 'pending';
type OverallStatus = 'ready' | 'ready_for_test' | 'config_pending' | 'error' | 'blocked';

interface ValidationCard {
  key: string;
  level: CardLevel;
  title: string;
  message: string;
  status_label?: string;
  details?: Record<string, any>;
}
interface ValidateResponse {
  success: boolean;
  ambiente?: 'homologacao' | 'producao';
  overall_status?: OverallStatus;
  next_action_label?: string | null;
  can_retry_activation?: boolean;
  auto_activation_attempted?: boolean;
  auto_activation_succeeded?: boolean;
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
  manual_register_url?: string;
  manual_register_event?: string;
  manual_register_cnpj?: string;
  status?: string;
  error?: string;
}

function levelDot(level: CardLevel) {
  if (level === 'ok') return <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />;
  if (level === 'pending') return <Clock className="h-4 w-4 text-amber-600 shrink-0" />;
  if (level === 'warn') return <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />;
  return <ShieldX className="h-4 w-4 text-destructive shrink-0" />;
}

export function FiscalValidationCompactCard() {
  const qc = useQueryClient();
  const [fallback, setFallback] = useState<RegisterResponse | null>(null);
  const [showToken, setShowToken] = useState(false);

  // FONTE ÚNICA — mesmo hook usado pelo card superior "Pronto para emitir NF-e?"
  const validateQuery = useFiscalReadiness();

  const registerMutation = useMutation({
    mutationFn: async (opts: { rotate_token?: boolean } = {}) => {
      const { data, error } = await supabase.functions.invoke('fiscal-webhook-register', { body: opts });
      if (error) throw new Error(error.message);
      return data as RegisterResponse;
    },
    onSuccess: (data) => {
      if (!data.success) {
        toast.error(data.error || 'Falha ao ativar recebimento automático');
        return;
      }
      if (data.auto_register_succeeded) {
        toast.success('Recebimento automático cadastrado.');
        setFallback(null);
        setShowToken(false);
      } else if (data.fallback) {
        toast.warning('Cadastro automático falhou — use o fallback manual abaixo.');
        setFallback(data);
      }
      qc.invalidateQueries({ queryKey: ['fiscal-integration-validate'] });
      qc.invalidateQueries({ queryKey: ['fiscal-settings'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao ativar recebimento automático'),
  });

  const data = validateQuery.data;
  const cards = data?.cards || [];
  const ambiente = data?.ambiente;
  const overall: OverallStatus | 'loading' = validateQuery.isLoading ? 'loading' : (data?.overall_status || 'config_pending');
  const nextAction = data?.next_action_label || null;
  const canRetry = !!data?.can_retry_activation;

  const overallBadge = () => {
    if (overall === 'loading') return <Badge variant="outline">Verificando…</Badge>;
    if (overall === 'ready') {
      return <Badge variant="outline" className="border-green-500/50 text-green-600 gap-1"><ShieldCheck className="h-3 w-3" />Pronto</Badge>;
    }
    if (overall === 'ready_for_test') {
      return <Badge variant="outline" className="border-green-500/50 text-green-600 gap-1"><FlaskConical className="h-3 w-3" />Pronto para teste</Badge>;
    }
    if (overall === 'config_pending') {
      return <Badge variant="outline" className="border-amber-500/50 text-amber-600 gap-1"><ShieldAlert className="h-3 w-3" />Configuração pendente</Badge>;
    }
    if (overall === 'error') {
      return <Badge variant="destructive" className="gap-1"><ShieldX className="h-3 w-3" />Erro</Badge>;
    }
    return <Badge variant="destructive" className="gap-1"><ShieldX className="h-3 w-3" />Bloqueado</Badge>;
  };

  const overallBorder =
    overall === 'ready' || overall === 'ready_for_test' ? 'border-green-500/40'
    : overall === 'config_pending' ? 'border-amber-500/40'
    : overall === 'error' || overall === 'blocked' ? 'border-destructive/40'
    : 'border-border';

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
    <Card id="card-validacao-fiscal" className={cn('border-2', overallBorder)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <PlugZap className="h-5 w-5" />
              Validação Fiscal
            </CardTitle>
            <CardDescription className="mt-1">
              {ambiente === 'producao'
                ? 'Confira se sua loja está pronta para emitir NF-e em produção.'
                : 'Confira se sua loja está pronta para o teste de homologação.'}
            </CardDescription>
          </div>
          {overallBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {validateQuery.isLoading && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {validateQuery.isError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Não foi possível validar agora: {(validateQuery.error as any)?.message || 'erro desconhecido'}
            </AlertDescription>
          </Alert>
        )}

        {!validateQuery.isLoading && nextAction && (overall === 'config_pending' || overall === 'error' || overall === 'blocked') && (
          <Alert className={cn(
            overall === 'config_pending' && 'border-amber-500/50 bg-amber-500/5',
            (overall === 'error' || overall === 'blocked') && 'border-destructive/50 bg-destructive/5',
          )}>
            <AlertCircle className={cn(
              'h-4 w-4',
              overall === 'config_pending' ? 'text-amber-600' : 'text-destructive',
            )} />
            <AlertDescription className="text-xs">{nextAction}</AlertDescription>
          </Alert>
        )}

        {!validateQuery.isLoading && overall === 'ready_for_test' && (
          <div className="text-xs text-muted-foreground">
            O recebimento automático será confirmado no primeiro retorno da NF de teste.
          </div>
        )}

        {!validateQuery.isLoading && cards.length > 0 && (
          <ul className="space-y-2">
            {cards.map((c) => {
              const valueLabel = c.status_label
                || (c.level === 'ok' ? 'OK'
                  : c.level === 'pending' ? 'Aguardando'
                  : c.level === 'warn' ? 'Configurar'
                  : 'Erro');
              return (
                <li key={c.key} className="flex items-start gap-2 text-sm">
                  {levelDot(c.level)}
                  <div className="flex-1 min-w-0 flex items-center justify-between gap-2 flex-wrap">
                    <div className="min-w-0">
                      <div className="font-medium">{c.title}</div>
                      {c.message && (
                        <div className="text-xs text-muted-foreground">{c.message}</div>
                      )}
                    </div>
                    <span className={cn(
                      'text-xs whitespace-nowrap',
                      c.level === 'ok' && 'text-green-700 dark:text-green-400',
                      c.level === 'pending' && 'text-amber-700 dark:text-amber-400',
                      c.level === 'warn' && 'text-amber-700 dark:text-amber-400',
                      c.level === 'error' && 'text-destructive',
                    )}>
                      {valueLabel}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <Separator />

        <div className="flex flex-wrap gap-2">
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
          {canRetry && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => registerMutation.mutate({})}
              disabled={registerMutation.isPending}
              className="gap-2"
            >
              {registerMutation.isPending
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <RefreshCw className="h-4 w-4" />}
              Tentar novamente
            </Button>
          )}
        </div>

        {/* Fallback manual seguro — só quando o cadastro automático falha */}
        {fallback && fallback.fallback && (
          <Alert className="border-amber-500/50 bg-amber-500/5">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="space-y-2">
              <div className="text-xs">
                Não conseguimos ativar automaticamente. Cadastre a URL abaixo no painel do provedor fiscal.
                <strong className="block mt-1">
                  Esta URL contém uma chave única desta loja. Trate como credencial sensível.
                </strong>
              </div>
              <div className="text-xs space-y-1">
                <div><strong>CNPJ:</strong> {fallback.manual_register_cnpj}</div>
                <div><strong>Ambiente:</strong> {fallback.ambiente}</div>
                <div className="break-all"><strong>URL pública:</strong> <span className="font-mono">{fallback.webhook_url_sanitized}</span></div>
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <code className="font-mono text-xs px-2 py-1 rounded bg-muted break-all">{maskedToken || '—'}</code>
                <Button size="sm" variant="ghost" onClick={() => setShowToken(s => !s)} className="gap-1 h-7">
                  {showToken ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  {showToken ? 'Ocultar' : 'Revelar'}
                </Button>
                <Button size="sm" variant="outline" onClick={copyManualUrl} className="gap-1 h-7">
                  <Copy className="h-3 w-3" /> Copiar URL completa
                </Button>
                <Button
                  size="sm" variant="ghost"
                  onClick={() => registerMutation.mutate({ rotate_token: true })}
                  disabled={registerMutation.isPending}
                  className="gap-1 h-7"
                >
                  <RefreshCw className="h-3 w-3" /> Rotacionar chave
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
