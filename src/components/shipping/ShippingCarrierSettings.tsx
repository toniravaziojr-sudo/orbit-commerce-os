import { useState, useEffect } from 'react';
import { 
  Settings, 
  CheckCircle, 
  Eye,
  EyeOff,
  Save,
  ExternalLink,
  Zap,
  RefreshCw,
  Calculator,
  Package,
  Key
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useShippingProviders, ShippingProviderInput } from '@/hooks/useShippingProviders';

interface CarrierField {
  key: string;
  label: string;
  type: 'text' | 'password';
  placeholder: string;
}

interface CarrierDefinition {
  id: string;
  name: string;
  logo: string;
  description: string;
  fields: CarrierField[];
  features: string[];
  docsUrl: string;
}

// Auth modes for Correios
type CorreiosAuthMode = 'oauth' | 'token';

interface CarrierField {
  key: string;
  label: string;
  type: 'text' | 'password';
  placeholder: string;
  showWhen?: { field: string; value: string }; // conditional display
}

interface CarrierDefinition {
  id: string;
  name: string;
  logo: string;
  description: string;
  fields: CarrierField[];
  features: string[];
  docsUrl: string;
  hasAuthModes?: boolean;
  authModes?: { value: string; label: string; description: string }[];
}

const CARRIER_DEFINITIONS: CarrierDefinition[] = [
  {
    id: 'frenet',
    name: 'Frenet',
    logo: '🚀',
    description: 'Gateway de frete com múltiplas transportadoras integradas',
    fields: [
      { key: 'token', label: 'Token de API', type: 'password', placeholder: 'Seu token Frenet' },
      { key: 'seller_cep', label: 'CEP de Origem', type: 'text', placeholder: '01310-100' },
    ],
    features: ['Cotação de Frete', 'Múltiplas Transportadoras', 'Rastreamento'],
    docsUrl: 'https://frenet.com.br/docs',
  },
  {
    id: 'correios',
    name: 'Correios',
    logo: '📦',
    description: 'Serviço postal brasileiro - PAC, SEDEX e mais.',
    hasAuthModes: true,
    authModes: [
      { value: 'token', label: 'Token CWS', description: 'Token estático do portal CWS (Correios Web Services)' },
      { value: 'oauth', label: 'OAuth2 (Usuário/Senha)', description: 'Autenticação via CNPJ + senha + cartão de postagem' },
    ],
    fields: [
      // Token mode fields
      { key: 'token', label: 'Token CWS', type: 'password', placeholder: 'Token do portal cws.correios.com.br', showWhen: { field: 'auth_mode', value: 'token' } },
      // OAuth mode fields
      { key: 'usuario', label: 'Usuário (CNPJ)', type: 'text', placeholder: '00000000000000', showWhen: { field: 'auth_mode', value: 'oauth' } },
      { key: 'senha', label: 'Senha', type: 'password', placeholder: 'Senha do portal', showWhen: { field: 'auth_mode', value: 'oauth' } },
      { key: 'cartao_postagem', label: 'Cartão de Postagem', type: 'text', placeholder: '0067599079', showWhen: { field: 'auth_mode', value: 'oauth' } },
    ],
    features: ['Rastreamento Automático', 'Cotação de Frete', 'Etiquetas'],
    docsUrl: 'https://cws.correios.com.br/dashboard/pesquisa',
  },
  {
    id: 'loggi',
    name: 'Loggi',
    logo: '🛵',
    description: 'Entregas urbanas rápidas e eficientes. Configure as credenciais do integrador.',
    fields: [
      { key: 'client_id', label: 'Client ID (Integrador)', type: 'text', placeholder: 'UUID do integrador' },
      { key: 'client_secret', label: 'Client Secret', type: 'password', placeholder: 'Segredo do integrador' },
      { key: 'integration_code', label: 'Código de Integração', type: 'text', placeholder: 'Código numérico fornecido pela Loggi' },
      { key: 'shipper_id', label: 'ID do Embarcador', type: 'text', placeholder: 'Identificador do embarcador (ex: 1491431)' },
    ],
    features: ['Cotação de Frete', 'Rastreamento', 'Coleta'],
    docsUrl: 'https://docs.api.loggi.com/',
  },
];

export function ShippingCarrierSettings() {
  const { providers, isLoading, upsertProvider, getProvider } = useShippingProviders();
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [formData, setFormData] = useState<Record<string, {
    enabled: boolean;
    supportsQuote: boolean;
    supportsTracking: boolean;
    fields: Record<string, string>;
  }>>({});

  // Initialize form data from saved providers
  useEffect(() => {
    const initialData: typeof formData = {};
    
    CARRIER_DEFINITIONS.forEach(carrier => {
      const saved = getProvider(carrier.id);
      
      // Build fields with auth_mode support
      const fields: Record<string, string> = {};
      
      // Initialize auth_mode with saved value or default to 'token' for correios
      if (carrier.hasAuthModes) {
        fields['auth_mode'] = saved?.credentials?.auth_mode as string || 
          (saved?.credentials?.token ? 'token' : 'token'); // default to token mode
      }
      
      // Initialize other fields
      carrier.fields.forEach(field => {
        fields[field.key] = saved?.credentials?.[field.key] as string || '';
      });
      
      initialData[carrier.id] = {
        enabled: saved?.is_enabled ?? false,
        supportsQuote: saved?.supports_quote ?? true,
        supportsTracking: saved?.supports_tracking ?? true,
        fields,
      };
    });
    
    setFormData(initialData);
  }, [providers]);

  const toggleSecret = (carrierId: string, fieldKey: string) => {
    const key = `${carrierId}-${fieldKey}`;
    setShowSecrets(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const updateField = (carrierId: string, fieldKey: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [carrierId]: {
        ...prev[carrierId],
        fields: {
          ...prev[carrierId]?.fields,
          [fieldKey]: value,
        },
      },
    }));
  };

  const toggleEnabled = (carrierId: string) => {
    setFormData(prev => ({
      ...prev,
      [carrierId]: {
        ...prev[carrierId],
        enabled: !prev[carrierId]?.enabled,
      },
    }));
  };

  const toggleSupportsQuote = (carrierId: string) => {
    setFormData(prev => ({
      ...prev,
      [carrierId]: {
        ...prev[carrierId],
        supportsQuote: !prev[carrierId]?.supportsQuote,
      },
    }));
  };

  const toggleSupportsTracking = (carrierId: string) => {
    setFormData(prev => ({
      ...prev,
      [carrierId]: {
        ...prev[carrierId],
        supportsTracking: !prev[carrierId]?.supportsTracking,
      },
    }));
  };

  const handleSave = async (carrierId: string) => {
    const data = formData[carrierId];
    if (!data) return;

    const input: ShippingProviderInput = {
      provider: carrierId,
      is_enabled: data.enabled,
      supports_quote: data.supportsQuote,
      supports_tracking: data.supportsTracking,
      credentials: data.fields,
    };

    await upsertProvider.mutateAsync(input);
  };

  const isConfigured = (carrierId: string) => {
    const data = formData[carrierId];
    if (!data) return false;
    const carrier = CARRIER_DEFINITIONS.find(c => c.id === carrierId);
    if (!carrier) return false;
    return carrier.fields.every(f => data.fields[f.key]?.trim() !== '');
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
            Transportadoras
          </CardTitle>
          <CardDescription>
            Configure as transportadoras para calcular frete, rastrear e gerar etiquetas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-primary/10 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Zap className="h-5 w-5 text-primary mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">Integração automática</p>
                <p className="text-muted-foreground">
                  Configure as credenciais abaixo e o sistema automaticamente calculará fretes
                  no checkout e carrinho. Você pode ativar múltiplas transportadoras simultaneamente.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {CARRIER_DEFINITIONS.map((carrier) => {
        const data = formData[carrier.id] || { enabled: false, supportsQuote: true, supportsTracking: true, fields: {} };
        const configured = isConfigured(carrier.id);

        return (
          <Card key={carrier.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{carrier.logo}</span>
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      {carrier.name}
                      {configured && data.enabled && (
                        <Badge variant="default" className="gap-1">
                          <CheckCircle className="h-3 w-3" />
                          Ativo
                        </Badge>
                      )}
                      {configured && !data.enabled && (
                        <Badge variant="secondary">Configurado</Badge>
                      )}
                    </CardTitle>
                    <CardDescription>{carrier.description}</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id={`${carrier.id}-enabled`}
                    checked={data.enabled}
                    onCheckedChange={() => toggleEnabled(carrier.id)}
                  />
                  <Label htmlFor={`${carrier.id}-enabled`} className="text-sm font-medium">
                    Ativo
                  </Label>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {carrier.features.map(feature => (
                  <Badge key={feature} variant="outline">{feature}</Badge>
                ))}
              </div>

              {/* Toggles de funcionalidades */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <p className="text-sm font-medium text-muted-foreground">Funcionalidades habilitadas</p>
                <div className="flex flex-wrap gap-6">
                  <div className="flex items-center gap-2">
                    <Switch
                      id={`${carrier.id}-quote`}
                      checked={data.supportsQuote ?? true}
                      onCheckedChange={() => toggleSupportsQuote(carrier.id)}
                      disabled={!data.enabled}
                    />
                    <Label 
                      htmlFor={`${carrier.id}-quote`} 
                      className={`text-sm flex items-center gap-1.5 ${!data.enabled ? 'text-muted-foreground' : ''}`}
                    >
                      <Calculator className="h-4 w-4" />
                      Cotação de Frete
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id={`${carrier.id}-tracking`}
                      checked={data.supportsTracking ?? true}
                      onCheckedChange={() => toggleSupportsTracking(carrier.id)}
                      disabled={!data.enabled}
                    />
                    <Label 
                      htmlFor={`${carrier.id}-tracking`} 
                      className={`text-sm flex items-center gap-1.5 ${!data.enabled ? 'text-muted-foreground' : ''}`}
                    >
                      <Package className="h-4 w-4" />
                      Rastreamento
                    </Label>
                  </div>
                </div>
                {!data.enabled && (
                  <p className="text-xs text-muted-foreground">Ative a transportadora para configurar funcionalidades</p>
                )}
              </div>

              <Separator />

              {/* Auth mode selector for carriers that support it */}
              {carrier.hasAuthModes && carrier.authModes && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Key className="h-4 w-4 text-muted-foreground" />
                    <Label className="text-sm font-medium">Modo de Autenticação</Label>
                  </div>
                  <RadioGroup
                    value={data.fields['auth_mode'] || 'token'}
                    onValueChange={(value) => updateField(carrier.id, 'auth_mode', value)}
                    className="grid gap-3 md:grid-cols-2"
                  >
                    {carrier.authModes.map((mode) => (
                      <div key={mode.value} className="flex items-start space-x-3">
                        <RadioGroupItem value={mode.value} id={`${carrier.id}-auth-${mode.value}`} className="mt-1" />
                        <Label htmlFor={`${carrier.id}-auth-${mode.value}`} className="flex flex-col cursor-pointer">
                          <span className="font-medium">{mode.label}</span>
                          <span className="text-xs text-muted-foreground">{mode.description}</span>
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                {carrier.fields
                  .filter((field) => {
                    // Filter fields based on showWhen condition
                    if (!field.showWhen) return true;
                    const currentValue = data.fields[field.showWhen.field] || 'token';
                    return currentValue === field.showWhen.value;
                  })
                  .map((field) => {
                    const secretKey = `${carrier.id}-${field.key}`;
                    const isVisible = showSecrets[secretKey] || field.type === 'text';
                    
                    return (
                      <div key={field.key} className="space-y-2">
                        <Label htmlFor={`${carrier.id}-${field.key}`}>{field.label}</Label>
                        <div className="relative">
                          <Input
                            id={`${carrier.id}-${field.key}`}
                            type={isVisible ? 'text' : 'password'}
                            placeholder={field.placeholder}
                            value={data.fields[field.key] || ''}
                            onChange={(e) => updateField(carrier.id, field.key, e.target.value)}
                            className="pr-10"
                          />
                          {field.type === 'password' && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                              onClick={() => toggleSecret(carrier.id, field.key)}
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
                {carrier.docsUrl ? (
                  <Button variant="outline" size="sm" asChild>
                    <a href={carrier.docsUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Documentação
                    </a>
                  </Button>
                ) : (
                  <div />
                )}
                <Button 
                  onClick={() => handleSave(carrier.id)}
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
    </div>
  );
}
