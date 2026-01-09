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
  TestTube,
  CreditCard,
  Shield
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { usePaymentProviders, PaymentProviderInput } from '@/hooks/usePaymentProviders';
import { PlatformAdminGate } from '@/components/auth/PlatformAdminGate';
import { Link } from 'react-router-dom';

interface GatewayField {
  key: string;
  label: string;
  type: 'text' | 'password';
  placeholder: string;
}

interface GatewayDefinition {
  id: string;
  name: string;
  logo: string;
  description: string;
  fields: GatewayField[];
  supportedMethods: string[];
  docsUrl: string;
}

const GATEWAY_DEFINITIONS: GatewayDefinition[] = [
  {
    id: 'pagarme',
    name: 'Pagar.me',
    logo: '💰',
    description: 'Gateway completo para e-commerce com PIX, Boleto e Cartão',
    fields: [
      { key: 'account_id', label: 'Account ID', type: 'text', placeholder: 'acc_...' },
      { key: 'api_key', label: 'Secret Key', type: 'password', placeholder: 'sk_...' },
      { key: 'public_key', label: 'Public Key', type: 'text', placeholder: 'pk_...' },
    ],
    supportedMethods: ['PIX', 'Cartão de Crédito', 'Boleto'],
    docsUrl: 'https://docs.pagar.me',
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
  },
];

export function PaymentGatewaySettings() {
  const { providers, isLoading, upsertProvider, getProvider } = usePaymentProviders();
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [formData, setFormData] = useState<Record<string, {
    enabled: boolean;
    environment: 'sandbox' | 'production';
    fields: Record<string, string>;
  }>>({});

  // Initialize form data from saved providers
  useEffect(() => {
    const initialData: typeof formData = {};
    
    GATEWAY_DEFINITIONS.forEach(gateway => {
      const saved = getProvider(gateway.id);
      initialData[gateway.id] = {
        enabled: saved?.is_enabled ?? false,
        environment: (saved?.environment as 'sandbox' | 'production') ?? 'sandbox',
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

  const toggleEnabled = (gatewayId: string) => {
    setFormData(prev => ({
      ...prev,
      [gatewayId]: {
        ...prev[gatewayId],
        enabled: !prev[gatewayId]?.enabled,
      },
    }));
  };

  const setEnvironment = (gatewayId: string, env: 'sandbox' | 'production') => {
    setFormData(prev => ({
      ...prev,
      [gatewayId]: {
        ...prev[gatewayId],
        environment: env,
      },
    }));
  };

  const handleSave = async (gatewayId: string) => {
    const data = formData[gatewayId];
    if (!data) return;

    const input: PaymentProviderInput = {
      provider: gatewayId,
      is_enabled: data.enabled,
      environment: data.environment,
      credentials: data.fields,
    };

    await upsertProvider.mutateAsync(input);
  };

  const isConfigured = (gatewayId: string) => {
    const data = formData[gatewayId];
    if (!data) return false;
    const gateway = GATEWAY_DEFINITIONS.find(g => g.id === gatewayId);
    if (!gateway) return false;
    return gateway.fields.every(f => data.fields[f.key]?.trim() !== '');
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Gateways de Pagamento
          </CardTitle>
          <CardDescription>
            Configure os gateways para processar pagamentos na sua loja
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-primary/10 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-primary mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">Integração ativa</p>
                <p className="text-muted-foreground">
                  Configure as credenciais abaixo. O checkout da loja usará automaticamente o gateway ativo.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {GATEWAY_DEFINITIONS.map((gateway) => {
        const data = formData[gateway.id] || { enabled: false, environment: 'sandbox', fields: {} };
        const configured = isConfigured(gateway.id);
        const saved = getProvider(gateway.id);

        return (
          <Card key={gateway.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{gateway.logo}</span>
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      {gateway.name}
                      {configured && data.enabled && (
                        <Badge variant="default" className="gap-1">
                          <CheckCircle className="h-3 w-3" />
                          Ativo
                        </Badge>
                      )}
                      {configured && !data.enabled && (
                        <Badge variant="secondary">Configurado</Badge>
                      )}
                      {saved && (
                        <Badge variant={data.environment === 'production' ? 'destructive' : 'outline'}>
                          {data.environment === 'production' ? 'Produção' : 'Sandbox'}
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription>{gateway.description}</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`${gateway.id}-enabled`} className="text-sm">
                      Ativo
                    </Label>
                    <Switch
                      id={`${gateway.id}-enabled`}
                      checked={data.enabled}
                      onCheckedChange={() => toggleEnabled(gateway.id)}
                    />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {gateway.supportedMethods.map(method => (
                  <Badge key={method} variant="outline">{method}</Badge>
                ))}
              </div>

              <Separator />

              {/* Environment selector */}
              <div className="space-y-2">
                <Label>Ambiente</Label>
                <Select
                  value={data.environment}
                  onValueChange={(v) => setEnvironment(gateway.id, v as 'sandbox' | 'production')}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sandbox">
                      <div className="flex items-center gap-2">
                        <TestTube className="h-4 w-4" />
                        Sandbox (Teste)
                      </div>
                    </SelectItem>
                    <SelectItem value="production">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" />
                        Produção
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                {data.environment === 'production' && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Transações reais serão processadas
                  </p>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {gateway.fields.map((field) => {
                  const secretKey = `${gateway.id}-${field.key}`;
                  const isVisible = showSecrets[secretKey] || field.type === 'text';
                  
                  return (
                    <div key={field.key} className="space-y-2">
                      <Label htmlFor={`${gateway.id}-${field.key}`}>{field.label}</Label>
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
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between pt-2">
                <Button variant="outline" size="sm" asChild>
                  <a href={gateway.docsUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Documentação
                  </a>
                </Button>
                <Button 
                  onClick={() => handleSave(gateway.id)}
                  disabled={upsertProvider.isPending}
                >
                  {upsertProvider.isPending ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Salvar
                </Button>
              </div>
            </CardContent>
        </Card>
        );
      })}

      {/* Platform Admin - Mercado Pago Billing Integration */}
      <PlatformAdminGate>
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <CreditCard className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    Mercado Pago - Billing da Plataforma
                    <Badge variant="outline" className="gap-1">
                      <Shield className="h-3 w-3" />
                      Admin
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    Integração para cobranças de assinaturas dos tenants da plataforma
                  </CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription>
                Esta integração é configurada via secrets do Cloud e é usada para o sistema de billing da plataforma.
                As credenciais <code className="text-xs bg-muted px-1 rounded">MP_ACCESS_TOKEN</code> e{' '}
                <code className="text-xs bg-muted px-1 rounded">MP_PUBLIC_KEY</code> devem estar configuradas.
              </AlertDescription>
            </Alert>

            <div className="flex items-center gap-4">
              <Button asChild>
                <Link to="/platform/billing">
                  <CreditCard className="h-4 w-4 mr-2" />
                  Gerenciar Billing
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <a 
                  href="https://www.mercadopago.com.br/developers/panel/app" 
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Painel Mercado Pago
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </PlatformAdminGate>
    </div>
  );
}
