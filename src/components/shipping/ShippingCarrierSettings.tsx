import { useState } from 'react';
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
import { toast } from 'sonner';

interface CarrierConfig {
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
  features: string[];
  docsUrl: string;
}

const defaultCarriers: CarrierConfig[] = [
  {
    id: 'correios',
    name: 'Correios',
    logo: '📦',
    description: 'Serviço postal brasileiro - PAC, SEDEX e mais',
    enabled: false,
    configured: false,
    fields: [
      { key: 'codigo_administrativo', label: 'Código Administrativo', type: 'text', placeholder: '08082650', value: '' },
      { key: 'cartao_postagem', label: 'Cartão de Postagem', type: 'text', placeholder: '0067599079', value: '' },
      { key: 'cnpj', label: 'CNPJ', type: 'text', placeholder: '00.000.000/0000-00', value: '' },
      { key: 'senha', label: 'Senha', type: 'password', placeholder: 'Senha dos Correios', value: '' },
    ],
    features: ['Cotação de Frete', 'Rastreamento', 'Etiquetas'],
    docsUrl: 'https://www.correios.com.br/enviar/precisa-de-ajuda/calculador-remoto-de-precos-e-prazos',
  },
  {
    id: 'loggi',
    name: 'Loggi',
    logo: '🚀',
    description: 'Entregas urbanas rápidas e eficientes',
    enabled: false,
    configured: false,
    fields: [
      { key: 'api_key', label: 'API Key', type: 'password', placeholder: 'loggi_api_key_...', value: '' },
      { key: 'company_id', label: 'Company ID', type: 'text', placeholder: 'company_123', value: '' },
    ],
    features: ['Cotação de Frete', 'Rastreamento', 'Coleta'],
    docsUrl: 'https://docs.api.loggi.com/',
  },
  {
    id: 'transportadora_direta',
    name: 'Transportadora Direta',
    logo: '🚛',
    description: 'Configure transportadoras próprias ou locais',
    enabled: false,
    configured: false,
    fields: [
      { key: 'nome', label: 'Nome da Transportadora', type: 'text', placeholder: 'Transportadora XYZ', value: '' },
      { key: 'telefone', label: 'Telefone', type: 'text', placeholder: '(11) 99999-9999', value: '' },
      { key: 'email', label: 'Email', type: 'text', placeholder: 'contato@transportadora.com', value: '' },
    ],
    features: ['Cadastro Manual', 'Rastreamento Manual'],
    docsUrl: '',
  },
];

export function ShippingCarrierSettings() {
  const [carriers, setCarriers] = useState<CarrierConfig[]>(defaultCarriers);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const toggleSecret = (carrierId: string, fieldKey: string) => {
    const key = `${carrierId}-${fieldKey}`;
    setShowSecrets(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const updateField = (carrierId: string, fieldKey: string, value: string) => {
    setCarriers(prev => prev.map(c => {
      if (c.id !== carrierId) return c;
      return {
        ...c,
        fields: c.fields.map(f => f.key === fieldKey ? { ...f, value } : f),
      };
    }));
  };

  const toggleEnabled = (carrierId: string) => {
    setCarriers(prev => prev.map(c => {
      if (c.id !== carrierId) return c;
      return { ...c, enabled: !c.enabled };
    }));
  };

  const handleSave = async (carrierId: string) => {
    setSaving(carrierId);
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    setCarriers(prev => prev.map(c => {
      if (c.id !== carrierId) return c;
      const allFieldsFilled = c.fields.every(f => f.value.trim() !== '');
      return { ...c, configured: allFieldsFilled };
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
            Transportadoras
          </CardTitle>
          <CardDescription>
            Configure as transportadoras para calcular frete, rastrear e gerar etiquetas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Zap className="h-5 w-5 text-primary mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">Integração automática</p>
                <p className="text-muted-foreground">
                  Configure as credenciais abaixo e o sistema automaticamente calculará fretes, 
                  gerará etiquetas e atualizará o rastreamento dos pedidos.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {carriers.map((carrier) => (
        <Card key={carrier.id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{carrier.logo}</span>
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    {carrier.name}
                    {carrier.configured && carrier.enabled && (
                      <Badge variant="default" className="gap-1">
                        <CheckCircle className="h-3 w-3" />
                        Ativo
                      </Badge>
                    )}
                    {carrier.configured && !carrier.enabled && (
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
                    checked={carrier.enabled}
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
                        value={field.value}
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
                disabled={saving === carrier.id}
              >
                {saving === carrier.id ? (
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
