import { useState, useEffect } from 'react';
import { 
  Settings, 
  Truck, 
  CheckCircle, 
  Eye,
  EyeOff,
  Save,
  ExternalLink,
  Zap,
  RefreshCw
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
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
    docsUrl: 'https://frfrenet.com.br/docs',
  },
  {
    id: 'correios',
    name: 'Correios',
    logo: '📦',
    description: 'Serviço postal brasileiro - PAC, SEDEX e mais. OAuth2 API.',
    fields: [
      { key: 'usuario', label: 'Usuário (E-mail ou CNPJ)', type: 'text', placeholder: 'seu@email.com ou 00.000.000/0000-00' },
      { key: 'senha', label: 'Senha', type: 'password', placeholder: 'Senha do Meu Correios' },
      { key: 'cartao_postagem', label: 'Cartão de Postagem', type: 'text', placeholder: '0067599079' },
    ],
    features: ['Rastreamento Automático', 'Cotação de Frete', 'Etiquetas'],
    docsUrl: 'https://www.correios.com.br/atendimento/developers',
  },
  {
    id: 'loggi',
    name: 'Loggi',
    logo: '🛵',
    description: 'Entregas urbanas rápidas e eficientes',
    fields: [
      { key: 'api_key', label: 'API Key', type: 'password', placeholder: 'loggi_api_key_...' },
      { key: 'company_id', label: 'Company ID', type: 'text', placeholder: 'company_123' },
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
    fields: Record<string, string>;
  }>>({});

  // Initialize form data from saved providers
  useEffect(() => {
    const initialData: typeof formData = {};
    
    CARRIER_DEFINITIONS.forEach(carrier => {
      const saved = getProvider(carrier.id);
      initialData[carrier.id] = {
        enabled: saved?.is_enabled ?? false,
        fields: carrier.fields.reduce((acc, field) => {
          acc[field.key] = saved?.credentials?.[field.key] || '';
          return acc;
        }, {} as Record<string, string>),
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

  const handleSave = async (carrierId: string) => {
    const data = formData[carrierId];
    if (!data) return;

    const input: ShippingProviderInput = {
      provider: carrierId,
      is_enabled: data.enabled,
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
                  no checkout e carrinho.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {CARRIER_DEFINITIONS.map((carrier) => {
        const data = formData[carrier.id] || { enabled: false, fields: {} };
        const configured = isConfigured(carrier.id);
        const saved = getProvider(carrier.id);

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
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`${carrier.id}-enabled`} className="text-sm">
                      Ativo
                    </Label>
                    <Switch
                      id={`${carrier.id}-enabled`}
                      checked={data.enabled}
                      onCheckedChange={() => toggleEnabled(carrier.id)}
                    />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {carrier.features.map(feature => (
                  <Badge key={feature} variant="outline">{feature}</Badge>
                ))}
              </div>

              <Separator />

              <div className="grid gap-4 md:grid-cols-2">
                {carrier.fields.map((field) => {
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
