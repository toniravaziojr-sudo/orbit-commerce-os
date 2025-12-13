import { useState } from 'react';
import { 
  Settings, 
  CreditCard, 
  CheckCircle, 
  AlertCircle,
  Eye,
  EyeOff,
  Save,
  ExternalLink
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

interface GatewayConfig {
  id: string;
  name: string;
  logo: string;
  description: string;
  enabled: boolean;
  configured: boolean;
  fields: {
    key: string;
    label: string;
    type: 'text' | 'password';
    placeholder: string;
    value: string;
  }[];
  supportedMethods: string[];
  docsUrl: string;
}

const defaultGateways: GatewayConfig[] = [
  {
    id: 'mercado_pago',
    name: 'Mercado Pago',
    logo: '💳',
    description: 'Aceite PIX, cartões e boleto com o Mercado Pago',
    enabled: false,
    configured: false,
    fields: [
      { key: 'public_key', label: 'Public Key', type: 'text', placeholder: 'APP_USR-...', value: '' },
      { key: 'access_token', label: 'Access Token', type: 'password', placeholder: 'APP_USR-...', value: '' },
    ],
    supportedMethods: ['PIX', 'Cartão de Crédito', 'Boleto'],
    docsUrl: 'https://www.mercadopago.com.br/developers',
  },
  {
    id: 'pagarme',
    name: 'PagarMe',
    logo: '💰',
    description: 'Gateway completo para e-commerce com split de pagamentos',
    enabled: false,
    configured: false,
    fields: [
      { key: 'api_key', label: 'API Key', type: 'password', placeholder: 'ak_live_...', value: '' },
      { key: 'encryption_key', label: 'Encryption Key', type: 'password', placeholder: 'ek_live_...', value: '' },
    ],
    supportedMethods: ['PIX', 'Cartão de Crédito', 'Boleto'],
    docsUrl: 'https://docs.pagar.me',
  },
];

export function PaymentGatewaySettings() {
  const [gateways, setGateways] = useState<GatewayConfig[]>(defaultGateways);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const toggleSecret = (gatewayId: string, fieldKey: string) => {
    const key = `${gatewayId}-${fieldKey}`;
    setShowSecrets(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const updateField = (gatewayId: string, fieldKey: string, value: string) => {
    setGateways(prev => prev.map(g => {
      if (g.id !== gatewayId) return g;
      return {
        ...g,
        fields: g.fields.map(f => f.key === fieldKey ? { ...f, value } : f),
      };
    }));
  };

  const toggleEnabled = (gatewayId: string) => {
    setGateways(prev => prev.map(g => {
      if (g.id !== gatewayId) return g;
      return { ...g, enabled: !g.enabled };
    }));
  };

  const handleSave = async (gatewayId: string) => {
    setSaving(gatewayId);
    
    // Simulate saving - in real implementation, this would save to tenant settings
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    setGateways(prev => prev.map(g => {
      if (g.id !== gatewayId) return g;
      const allFieldsFilled = g.fields.every(f => f.value.trim() !== '');
      return { ...g, configured: allFieldsFilled };
    }));
    
    setSaving(null);
    toast.success('Configurações salvas com sucesso');
  };

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
        <CardContent className="space-y-6">
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">Integração futura</p>
                <p className="text-muted-foreground">
                  As configurações abaixo serão utilizadas quando o checkout do storefront estiver implementado. 
                  Por enquanto, você pode pré-configurar as credenciais.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {gateways.map((gateway) => (
        <Card key={gateway.id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{gateway.logo}</span>
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    {gateway.name}
                    {gateway.configured && gateway.enabled && (
                      <Badge variant="default" className="gap-1">
                        <CheckCircle className="h-3 w-3" />
                        Ativo
                      </Badge>
                    )}
                    {gateway.configured && !gateway.enabled && (
                      <Badge variant="secondary">Configurado</Badge>
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
                    checked={gateway.enabled}
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
                        value={field.value}
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
                disabled={saving === gateway.id}
              >
                {saving === gateway.id ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Salvar
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function RefreshCw(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </svg>
  );
}
