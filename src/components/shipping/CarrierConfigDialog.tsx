import { useState, useEffect } from 'react';
import { 
  Eye, 
  EyeOff, 
  Save, 
  ExternalLink, 
  Calculator, 
  Package, 
  Key,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  Plug,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useShippingProviders, ShippingProviderInput, TestConnectionResult } from '@/hooks/useShippingProviders';

interface CarrierField {
  key: string;
  label: string;
  type: 'text' | 'password';
  placeholder: string;
  showWhen?: { field: string; value: string };
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
  authModes?: { value: string; label: string; description: string; recommended?: boolean }[];
}

import { getTokenStatus } from '@/lib/tokenUtils';

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
      { 
        value: 'oauth', 
        label: 'OAuth2 (Recomendado)', 
        description: 'Autenticação automática via CNPJ + senha + cartão.',
        recommended: true
      },
      { 
        value: 'token', 
        label: 'Token Manual', 
        description: 'Token do portal CWS. Expira a cada 24h.'
      },
    ],
    fields: [
      { key: 'usuario', label: 'Usuário (CNPJ)', type: 'text', placeholder: '00000000000000', showWhen: { field: 'auth_mode', value: 'oauth' } },
      { key: 'senha', label: 'Senha', type: 'password', placeholder: 'Senha do portal', showWhen: { field: 'auth_mode', value: 'oauth' } },
      { key: 'cartao_postagem', label: 'Cartão de Postagem', type: 'text', placeholder: '0067599079', showWhen: { field: 'auth_mode', value: 'oauth' } },
      { key: 'token', label: 'Token CWS', type: 'password', placeholder: 'Token do portal cws.correios.com.br', showWhen: { field: 'auth_mode', value: 'token' } },
    ],
    features: ['Rastreamento Automático', 'Cotação de Frete', 'Etiquetas'],
    docsUrl: 'https://cws.correios.com.br/dashboard/pesquisa',
  },
  {
    id: 'loggi',
    name: 'Loggi',
    logo: '🛵',
    description: 'Entregas urbanas rápidas e eficientes.',
    fields: [
      { key: 'integration_code', label: 'ID do Integrador', type: 'text', placeholder: '8a13a390-adac-4261-b7c3-b591cdcd18c6' },
      { key: 'company_id', label: 'ID do Embarcador', type: 'text', placeholder: '1491431' },
      { key: 'origin_cep', label: 'CEP de Origem', type: 'text', placeholder: '01310-100' },
      { key: 'origin_street', label: 'Rua/Logradouro Origem', type: 'text', placeholder: 'Av. Paulista' },
      { key: 'origin_number', label: 'Número', type: 'text', placeholder: '1636' },
      { key: 'origin_neighborhood', label: 'Bairro', type: 'text', placeholder: 'Bela Vista' },
      { key: 'origin_city', label: 'Cidade', type: 'text', placeholder: 'São Paulo' },
      { key: 'origin_state', label: 'Estado (UF)', type: 'text', placeholder: 'SP' },
    ],
    features: ['Cotação de Frete', 'Rastreamento', 'Etiquetas', 'Criação de Remessa'],
    docsUrl: 'https://docs.api.loggi.com/',
  },
];

interface CarrierConfigDialogProps {
  carrierId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CarrierConfigDialog({ carrierId, open, onOpenChange }: CarrierConfigDialogProps) {
  const { getProvider, upsertProvider, testConnection } = useShippingProviders();
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [testResult, setTestResult] = useState<TestConnectionResult | null>(null);
  const [formData, setFormData] = useState<{
    enabled: boolean;
    supportsQuote: boolean;
    supportsTracking: boolean;
    fields: Record<string, string>;
  }>({
    enabled: false,
    supportsQuote: true,
    supportsTracking: true,
    fields: {},
  });

  const carrier = CARRIER_DEFINITIONS.find(c => c.id === carrierId);
  const saved = carrierId ? getProvider(carrierId) : null;

  // Initialize form data when carrier changes
  useEffect(() => {
    if (!carrier) return;

    const fields: Record<string, string> = {};
    
    if (carrier.hasAuthModes) {
      const savedAuthMode = saved?.credentials?.auth_mode as string;
      fields['auth_mode'] = savedAuthMode || 
        (saved?.credentials?.token && !saved?.credentials?.usuario ? 'token' : 'oauth');
    }
    
    carrier.fields.forEach(field => {
      fields[field.key] = saved?.credentials?.[field.key] as string || '';
    });
    
    setFormData({
      enabled: saved?.is_enabled ?? false,
      supportsQuote: saved?.supports_quote ?? true,
      supportsTracking: saved?.supports_tracking ?? true,
      fields,
    });
    setShowSecrets({});
    setTestResult(null);
  }, [carrier, saved, open]);

  // Clear test result when credentials change
  const updateField = (fieldKey: string, value: string) => {
    setTestResult(null);
    setFormData(prev => ({
      ...prev,
      fields: {
        ...prev.fields,
        [fieldKey]: value,
      },
    }));
  };

  const toggleSecret = (fieldKey: string) => {
    setShowSecrets(prev => ({ ...prev, [fieldKey]: !prev[fieldKey] }));
  };

  const handleTestConnection = async () => {
    if (!carrierId) return;
    
    setTestResult(null);
    
    try {
      const result = await testConnection.mutateAsync({
        provider: carrierId,
        credentials: formData.fields,
      });
      setTestResult(result);
    } catch (error) {
      setTestResult({
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao testar conexão',
      });
    }
  };

  const canTestConnection = (): boolean => {
    if (!carrier) return false;
    
    // Check if this carrier supports test connection
    if (!['correios', 'loggi'].includes(carrier.id)) return false;
    
    // Check required fields based on auth mode
    if (carrier.id === 'correios') {
      const authMode = formData.fields['auth_mode'] || 'oauth';
      if (authMode === 'oauth') {
        return !!(formData.fields['usuario'] && formData.fields['senha'] && formData.fields['cartao_postagem']);
      } else {
        return !!formData.fields['token'];
      }
    }
    
    if (carrier.id === 'loggi') {
      return !!(formData.fields['integration_code'] && formData.fields['company_id']);
    }
    
    return true;
  };

  const handleSave = async () => {
    if (!carrierId) return;

    const input: ShippingProviderInput = {
      provider: carrierId,
      is_enabled: formData.enabled,
      supports_quote: formData.supportsQuote,
      supports_tracking: formData.supportsTracking,
      credentials: formData.fields,
    };

    await upsertProvider.mutateAsync(input);
    onOpenChange(false);
  };

  const shouldShowField = (field: CarrierField): boolean => {
    if (!field.showWhen) return true;
    return formData.fields[field.showWhen.field] === field.showWhen.value;
  };

  if (!carrier) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-2xl">{carrier.logo}</span>
            Configurar {carrier.name}
          </DialogTitle>
          <DialogDescription>{carrier.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Enable Toggle */}
          <div className="flex items-center justify-between p-4 rounded-lg border">
            <div>
              <Label className="text-base font-medium">Ativar {carrier.name}</Label>
              <p className="text-sm text-muted-foreground">
                Usar esta transportadora para cotação e rastreamento
              </p>
            </div>
            <Switch
              checked={formData.enabled}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, enabled: checked }))}
            />
          </div>

          {/* Features */}
          <div className="flex flex-wrap gap-2">
            {carrier.features.map(feature => (
              <Badge key={feature} variant="outline">{feature}</Badge>
            ))}
          </div>

          {/* Feature Toggles */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <p className="text-sm font-medium text-muted-foreground">Funcionalidades</p>
            <div className="flex flex-wrap gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.supportsQuote}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, supportsQuote: checked }))}
                  disabled={!formData.enabled}
                />
                <Label className={`text-sm flex items-center gap-1.5 ${!formData.enabled ? 'text-muted-foreground' : ''}`}>
                  <Calculator className="h-4 w-4" />
                  Cotação de Frete
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.supportsTracking}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, supportsTracking: checked }))}
                  disabled={!formData.enabled}
                />
                <Label className={`text-sm flex items-center gap-1.5 ${!formData.enabled ? 'text-muted-foreground' : ''}`}>
                  <Package className="h-4 w-4" />
                  Rastreamento
                </Label>
              </div>
            </div>
          </div>

          <Separator />

          {/* Auth Mode Selection (for carriers that support it) */}
          {carrier.hasAuthModes && carrier.authModes && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Key className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm font-medium">Modo de Autenticação</Label>
              </div>
              <RadioGroup
                value={formData.fields['auth_mode'] || 'oauth'}
                onValueChange={(value) => updateField('auth_mode', value)}
                className="grid gap-3"
              >
                {carrier.authModes.map((mode) => (
                  <div 
                    key={mode.value} 
                    className={`flex items-start space-x-3 p-3 rounded-lg border ${
                      mode.recommended ? 'border-primary/50 bg-primary/5' : 'border-border'
                    }`}
                  >
                    <RadioGroupItem value={mode.value} id={`auth-${mode.value}`} className="mt-1" />
                    <Label htmlFor={`auth-${mode.value}`} className="flex flex-col cursor-pointer flex-1">
                      <span className="font-medium flex items-center gap-2">
                        {mode.label}
                        {mode.recommended && (
                          <Badge variant="secondary" className="text-xs">Recomendado</Badge>
                        )}
                      </span>
                      <span className="text-xs text-muted-foreground">{mode.description}</span>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
              
              {/* Token status for Correios token mode */}
              {carrier.id === 'correios' && formData.fields['auth_mode'] === 'token' && (() => {
                const tokenStatus = getTokenStatus(formData.fields['token']);
                
                if (tokenStatus.status === 'none') return null;
                
                return (
                  <Alert variant={tokenStatus.status === 'expired' ? 'destructive' : 'default'} className="mt-3">
                    {tokenStatus.status === 'ok' && <ShieldCheck className="h-4 w-4" />}
                    {tokenStatus.status === 'expiring' && <AlertTriangle className="h-4 w-4" />}
                    {tokenStatus.status === 'expired' && <ShieldAlert className="h-4 w-4" />}
                    <AlertTitle>
                      {tokenStatus.status === 'ok' && 'Token válido'}
                      {tokenStatus.status === 'expiring' && 'Token expirando'}
                      {tokenStatus.status === 'expired' && 'Token expirado'}
                      {tokenStatus.status === 'invalid' && 'Token inválido'}
                    </AlertTitle>
                    <AlertDescription className="text-sm">
                      {tokenStatus.status === 'ok' && tokenStatus.expiresAt && (
                        <>Expira em: {tokenStatus.expiresAt.toLocaleString('pt-BR')}</>
                      )}
                      {tokenStatus.status === 'expiring' && 'Atualize o token ou mude para OAuth2.'}
                      {tokenStatus.status === 'expired' && 'Atualize o token para continuar usando.'}
                    </AlertDescription>
                  </Alert>
                );
              })()}
            </div>
          )}

          {/* Fields */}
          <div className="space-y-4">
            <Label className="text-sm font-medium">Credenciais</Label>
            {carrier.fields.filter(shouldShowField).map((field) => (
              <div key={field.key} className="space-y-2">
                <Label htmlFor={field.key} className="text-sm">{field.label}</Label>
                <div className="relative">
                  <Input
                    id={field.key}
                    type={field.type === 'password' && !showSecrets[field.key] ? 'password' : 'text'}
                    placeholder={field.placeholder}
                    value={formData.fields[field.key] || ''}
                    onChange={(e) => updateField(field.key, e.target.value)}
                    className="pr-10"
                  />
                  {field.type === 'password' && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => toggleSecret(field.key)}
                    >
                      {showSecrets[field.key] ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Test Connection Button */}
          {['correios', 'loggi'].includes(carrier.id) && (
            <div className="space-y-3">
              <Button 
                type="button"
                variant="outline"
                onClick={handleTestConnection}
                disabled={testConnection.isPending || !canTestConnection()}
                className="w-full gap-2"
              >
                {testConnection.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Testando conexão...
                  </>
                ) : (
                  <>
                    <Plug className="h-4 w-4" />
                    Testar Conexão
                  </>
                )}
              </Button>

              {/* Test Result Feedback */}
              {testResult && (
                <Alert variant={testResult.success ? 'default' : 'destructive'}>
                  {testResult.success ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  <AlertTitle>
                    {testResult.success ? 'Conexão bem-sucedida!' : 'Falha na conexão'}
                  </AlertTitle>
                  <AlertDescription className="text-sm">
                    {testResult.success ? (
                      <>
                        {testResult.token_expires_at && (
                          <span>Token válido até: {new Date(testResult.token_expires_at).toLocaleString('pt-BR')}</span>
                        )}
                        {testResult.cep_lookup_works && (
                          <span className="block text-xs mt-1">✓ Consulta de CEP funcionando</span>
                        )}
                      </>
                    ) : (
                      testResult.error
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Docs Link */}
          <Button variant="link" className="p-0 h-auto" asChild>
            <a href={carrier.docsUrl} target="_blank" rel="noopener noreferrer">
              Ver documentação
              <ExternalLink className="h-3 w-3 ml-1" />
            </a>
          </Button>

          {/* Save Button */}
          <Button 
            onClick={handleSave} 
            className="w-full gap-2"
            disabled={upsertProvider.isPending}
          >
            <Save className="h-4 w-4" />
            {upsertProvider.isPending ? 'Salvando...' : 'Salvar Configuração'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
