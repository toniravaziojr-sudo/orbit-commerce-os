import { useState, useEffect } from 'react';
import { 
  Settings, 
  CheckCircle, 
  AlertCircle,
  Eye,
  EyeOff,
  Save,
  ExternalLink,
  RefreshCw,
  CreditCard,
  Shield,
  Unplug,
  ChevronDown,
  ChevronUp,
  Plug,
  Copy,
  Check
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { usePaymentProviders, PaymentProviderInput } from '@/hooks/usePaymentProviders';
import { PlatformAdminGate } from '@/components/auth/PlatformAdminGate';
import { Link } from 'react-router-dom';

interface GatewayField {
  key: string;
  label: string;
  type: 'text' | 'password';
  placeholder: string;
  optional?: boolean;
  helpText?: string;
  validatePrefix?: string[];
}

interface GatewayDefinition {
  id: string;
  name: string;
  logo: string;
  description: string;
  fields: GatewayField[];
  supportedMethods: string[];
  docsUrl: string;
  comingSoon?: boolean;
  webhookUrl?: string;
  webhookInstructions?: string;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

const GATEWAY_DEFINITIONS: GatewayDefinition[] = [
  {
    id: 'pagarme',
    name: 'Pagar.me',
    logo: '💰',
    description: 'Gateway completo para e-commerce com PIX, Boleto e Cartão',
    fields: [
      { key: 'account_id', label: 'Account ID', type: 'text', placeholder: 'acc_...', validatePrefix: ['acc_'] },
      { key: 'api_key', label: 'Secret Key', type: 'password', placeholder: 'sk_...', validatePrefix: ['sk_'] },
      { key: 'public_key', label: 'Public Key', type: 'text', placeholder: 'pk_... (opcional)', optional: true, helpText: 'Usada apenas para tokenização no navegador. Não é necessária para PIX, Boleto ou checkout server-side.' },
    ],
    supportedMethods: ['PIX', 'Cartão de Crédito', 'Boleto'],
    docsUrl: 'https://docs.pagar.me',
    webhookUrl: `${SUPABASE_URL}/functions/v1/pagarme-webhook`,
    webhookInstructions: 'Acesse o Dashboard da Pagar.me → Configurações → Webhooks → Adicione esta URL.',
  },
  {
    id: 'pagbank',
    name: 'PagBank (PagSeguro)',
    logo: '🏦',
    description: 'Aceite PIX, cartões (com parcelamento) e boleto via PagBank',
    fields: [
      { key: 'token', label: 'Token', type: 'password', placeholder: 'Token de autenticação' },
      { key: 'email', label: 'Email da Conta', type: 'text', placeholder: 'seu@email.com' },
    ],
    supportedMethods: ['PIX', 'Cartão de Crédito', 'Boleto'],
    docsUrl: 'https://dev.pagbank.uol.com.br/reference',
    comingSoon: true,
  },
  {
    id: 'mercado_pago',
    name: 'Mercado Pago',
    logo: '💳',
    description: 'Aceite PIX, cartões e boleto com o Mercado Pago',
    fields: [
      { key: 'public_key', label: 'Public Key', type: 'text', placeholder: 'APP_USR-...' },
      { key: 'access_token', label: 'Access Token', type: 'password', placeholder: 'APP_USR-...' },
    ],
    supportedMethods: ['PIX', 'Cartão de Crédito', 'Boleto'],
    docsUrl: 'https://www.mercadopago.com.br/developers',
    webhookUrl: `${SUPABASE_URL}/functions/v1/mercadopago-storefront-webhook`,
    webhookInstructions: 'Acesse Mercado Pago → Sua aplicação → Webhooks → Configure esta URL para receber notificações de pagamento.',
  },
];

export function PaymentGatewaySettings() {
  const { providers, isLoading, upsertProvider, deleteProvider, getProvider } = usePaymentProviders();
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [expandedGateway, setExpandedGateway] = useState<string | null>(null);
  const [disconnectDialog, setDisconnectDialog] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, {
    fields: Record<string, string>;
  }>>({});

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedUrl(label);
      toast.success('URL copiada!');
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch {
      toast.error('Erro ao copiar');
    }
  };

  // Initialize form data from saved providers
  useEffect(() => {
    const initialData: typeof formData = {};
    
    GATEWAY_DEFINITIONS.forEach(gateway => {
      const saved = getProvider(gateway.id);
      initialData[gateway.id] = {
        fields: gateway.fields.reduce((acc, field) => {
          acc[field.key] = saved?.credentials?.[field.key] || '';
          return acc;
        }, {} as Record<string, string>),
      };
    });
    
    setFormData(initialData);
  }, [providers]);

  const toggleSecret = (gatewayId: string, fieldKey: string) => {
    const key = `${gatewayId}-${fieldKey}`;
    setShowSecrets(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const updateField = (gatewayId: string, fieldKey: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [gatewayId]: {
        ...prev[gatewayId],
        fields: {
          ...prev[gatewayId]?.fields,
          [fieldKey]: value,
        },
      },
    }));
  };

  const handleSave = async (gatewayId: string) => {
    const data = formData[gatewayId];
    if (!data) return;

    const gateway = GATEWAY_DEFINITIONS.find(g => g.id === gatewayId);
    if (!gateway) return;

    // Sanitize: trim all values and drop empty optional fields
    const sanitized: Record<string, string> = {};
    for (const field of gateway.fields) {
      const raw = (data.fields[field.key] ?? '').trim();
      if (!raw) {
        if (field.optional) continue; // skip empty optional
        toast.error(`Preencha o campo "${field.label}"`);
        return;
      }
      // Light prefix validation (only when defined)
      if (field.validatePrefix && !field.validatePrefix.some(p => raw.startsWith(p))) {
        toast.error(`"${field.label}" deve começar com ${field.validatePrefix.join(' ou ')}`);
        return;
      }
      sanitized[field.key] = raw;
    }

    const input: PaymentProviderInput = {
      provider: gatewayId,
      is_enabled: true,
      environment: 'production',
      credentials: sanitized,
    };

    await upsertProvider.mutateAsync(input);
    setExpandedGateway(null);
  };

  const handleDisconnect = async (gatewayId: string) => {
    const saved = getProvider(gatewayId);
    if (saved) {
      await deleteProvider.mutateAsync(saved.id);
      toast.success('Gateway desconectado');
    }
    setDisconnectDialog(null);
  };

  const isConfigured = (gatewayId: string) => {
    const data = formData[gatewayId];
    if (!data) return false;
    const gateway = GATEWAY_DEFINITIONS.find(g => g.id === gatewayId);
    if (!gateway) return false;
    // Only required (non-optional) fields must be filled
    return gateway.fields
      .filter(f => !f.optional)
      .every(f => (data.fields[f.key] ?? '').trim() !== '');
  };

  const isConnected = (gatewayId: string) => {
    const saved = getProvider(gatewayId);
    return saved && saved.is_enabled;
  };

  const maskCredential = (value: string) => {
    if (!value || value.length < 8) return '••••••••';
    return value.substring(0, 4) + '••••' + value.substring(value.length - 4);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
        <Settings className="h-4 w-4" />
        <span>Configure os gateways para processar pagamentos na sua loja</span>
      </div>

      {GATEWAY_DEFINITIONS.map((gateway) => {
        const data = formData[gateway.id] || { fields: {} };
        const connected = isConnected(gateway.id);
        const saved = getProvider(gateway.id);
        const isExpanded = expandedGateway === gateway.id;

        return (
          <Card key={gateway.id} className={connected ? 'border-primary/50 bg-primary/5' : ''}>
            <Collapsible open={isExpanded} onOpenChange={(open) => setExpandedGateway(open ? gateway.id : null)}>
              <CardHeader className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{gateway.logo}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base">{gateway.name}</CardTitle>
                        {gateway.comingSoon ? (
                          <Badge variant="outline" className="gap-1 bg-amber-100 text-amber-700 border-amber-300">
                            Em breve
                          </Badge>
                        ) : connected ? (
                          <Badge variant="default" className="gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Conectado
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1">
                            <AlertCircle className="h-3 w-3" />
                            Não conectado
                          </Badge>
                        )}
                      </div>
                      {connected && saved && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {gateway.fields.map(f => f.label).join(' • ')} configurados
                        </p>
                      )}
                      {!connected && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {gateway.supportedMethods.join(' • ')}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {connected && !gateway.comingSoon && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDisconnectDialog(gateway.id);
                        }}
                      >
                        <Unplug className="h-4 w-4 mr-1" />
                        Desconectar
                      </Button>
                    )}
                    {gateway.comingSoon ? (
                      <Button variant="ghost" size="sm" disabled>
                        Em breve
                      </Button>
                    ) : (
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm">
                          {connected ? 'Editar' : 'Configurar'}
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 ml-1" />
                          ) : (
                            <ChevronDown className="h-4 w-4 ml-1" />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                    )}
                  </div>
                </div>
              </CardHeader>

              <CollapsibleContent>
                <CardContent className="pt-0 space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    {gateway.fields.map((field) => {
                      const secretKey = `${gateway.id}-${field.key}`;
                      const isVisible = showSecrets[secretKey] || field.type === 'text';
                      
                      return (
                        <div key={field.key} className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Label htmlFor={`${gateway.id}-${field.key}`}>{field.label}</Label>
                            {field.optional && (
                              <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                                Opcional
                              </Badge>
                            )}
                          </div>
                          <div className="relative">
                            <Input
                              id={`${gateway.id}-${field.key}`}
                              type={isVisible ? 'text' : 'password'}
                              placeholder={field.placeholder}
                              value={data.fields[field.key] || ''}
                              onChange={(e) => updateField(gateway.id, field.key, e.target.value)}
                              className="pr-10"
                            />
                            {field.type === 'password' && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                                onClick={() => toggleSecret(gateway.id, field.key)}
                              >
                                {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </Button>
                            )}
                          </div>
                          {field.helpText && (
                            <p className="text-xs text-muted-foreground leading-snug">
                              {field.helpText}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Webhook URL Section */}
                  {gateway.webhookUrl && connected && (
                    <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                      <Label className="text-sm font-medium">URL do Webhook</Label>
                      <p className="text-xs text-muted-foreground">
                        {gateway.webhookInstructions}
                      </p>
                      <div className="flex gap-2">
                        <Input
                          value={gateway.webhookUrl}
                          readOnly
                          className="font-mono text-xs"
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => copyToClipboard(gateway.webhookUrl!, `webhook-${gateway.id}`)}
                        >
                          {copiedUrl === `webhook-${gateway.id}` ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t">
                    <Button variant="outline" size="sm" asChild>
                      <a href={gateway.docsUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Documentação
                      </a>
                    </Button>
                    <Button 
                      onClick={() => handleSave(gateway.id)}
                      disabled={upsertProvider.isPending || !isConfigured(gateway.id)}
                    >
                      {upsertProvider.isPending ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : connected ? (
                        <Save className="h-4 w-4 mr-2" />
                      ) : (
                        <Plug className="h-4 w-4 mr-2" />
                      )}
                      {connected ? 'Salvar' : 'Conectar'}
                    </Button>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        );
      })}

      {/* Disconnect confirmation dialog */}
      <AlertDialog open={!!disconnectDialog} onOpenChange={() => setDisconnectDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desconectar Gateway</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja desconectar este gateway de pagamento? 
              As credenciais serão removidas e você precisará reconfigurá-las para usar novamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => disconnectDialog && handleDisconnect(disconnectDialog)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <Unplug className="h-4 w-4 mr-2" />
              Desconectar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Platform Admin - Mercado Pago Billing Integration */}
      <PlatformAdminGate>
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <CreditCard className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    Mercado Pago - Billing
                    <Badge variant="outline" className="gap-1">
                      <Shield className="h-3 w-3" />
                      Admin
                    </Badge>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Cobranças de assinaturas dos tenants
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" asChild>
                  <Link to="/platform/billing">
                    <CreditCard className="h-4 w-4 mr-1" />
                    Gerenciar
                  </Link>
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>
      </PlatformAdminGate>
    </div>
  );
}