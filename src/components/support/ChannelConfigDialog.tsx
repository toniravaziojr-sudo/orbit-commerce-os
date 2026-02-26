import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExternalLink, Eye, EyeOff, Info, CheckCircle, Link2, ShoppingCart } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { ChannelAccount } from "@/hooks/useChannelAccounts";
import type { SupportChannelType } from "@/hooks/useConversations";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useMeliConnection } from "@/hooks/useMeliConnection";
import { IntegrationRequiredAlert } from "@/components/ui/integration-required-alert";

interface ChannelConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channel: ChannelAccount | null;
  channelType: SupportChannelType;
  onSave: () => void;
}

interface ChannelConfig {
  // Email
  imap_host?: string;
  imap_port?: string;
  imap_user?: string;
  imap_password?: string;
  smtp_host?: string;
  smtp_port?: string;
  smtp_user?: string;
  smtp_password?: string;
  email_address?: string;
  // Facebook/Instagram (Meta)
  page_id?: string;
  page_access_token?: string;
  app_id?: string;
  app_secret?: string;
  // Mercado Livre
  ml_client_id?: string;
  ml_client_secret?: string;
  ml_access_token?: string;
  ml_refresh_token?: string;
  ml_user_id?: string;
  // Shopee
  shopee_partner_id?: string;
  shopee_partner_key?: string;
  shopee_shop_id?: string;
  shopee_access_token?: string;
}

interface WhatsAppConfig {
  id: string;
  connection_status: string;
  phone_number: string | null;
  is_enabled: boolean;
}

const channelDocs: Record<SupportChannelType, { url: string; instructions: string }> = {
  whatsapp: {
    url: '/integrations#whatsapp',
    instructions: 'O WhatsApp usa as credenciais já configuradas em Integrações → WhatsApp. Basta vincular a conta existente.',
  },
  email: {
    url: '/emails',
    instructions: 'Configure o email de atendimento em Emails → Suporte. O recebimento é via SendGrid Inbound Parse.',
  },
  facebook_messenger: {
    url: 'https://developers.facebook.com/apps',
    instructions: 'Crie um app no Meta for Developers, adicione o produto Messenger e obtenha o Page Access Token.',
  },
  instagram_dm: {
    url: 'https://developers.facebook.com/apps',
    instructions: 'O Instagram DM usa a mesma API do Messenger. Configure um app Meta com permissões de Instagram.',
  },
  mercadolivre: {
    url: 'https://developers.mercadolivre.com.br/devcenter',
    instructions: 'Registre sua aplicação no Portal de Desenvolvedores ML e obtenha as credenciais OAuth.',
  },
  shopee: {
    url: 'https://open.shopee.com',
    instructions: 'Registre-se como parceiro Shopee e obtenha as credenciais da API para sua loja.',
  },
  tiktokshop: {
    url: '/integrations?tab=tiktok',
    instructions: 'A conexão com o TikTok Shop é feita pelo Hub de Integrações. Vincule sua conta para receber mensagens.',
  },
  chat: {
    url: '',
    instructions: 'O chat do site é ativado automaticamente. Ele aparecerá como um widget flutuante na sua loja virtual.',
  },
};

export function ChannelConfigDialog({
  open,
  onOpenChange,
  channel,
  channelType,
  onSave,
}: ChannelConfigDialogProps) {
  const { currentTenant } = useAuth();
  const navigate = useNavigate();
  const { isConnected: meliConnected, connection: meliConnection, isLoading: meliLoading } = useMeliConnection();
  const [config, setConfig] = useState<ChannelConfig>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [whatsappConfig, setWhatsappConfig] = useState<WhatsAppConfig | null>(null);
  const [loadingWhatsapp, setLoadingWhatsapp] = useState(false);

  useEffect(() => {
    if (channel?.metadata) {
      setConfig((channel.metadata as ChannelConfig) || {});
    } else {
      setConfig({});
    }
  }, [channel]);

  // Fetch WhatsApp config from existing integration
  useEffect(() => {
    const fetchWhatsappConfig = async () => {
      if (!open || channelType !== 'whatsapp' || !currentTenant?.id) return;
      
      setLoadingWhatsapp(true);
      try {
        const { data, error } = await supabase.rpc('get_whatsapp_config_for_tenant', { 
          p_tenant_id: currentTenant.id 
        });
        
        if (!error && data && data.length > 0) {
          setWhatsappConfig({
            id: data[0].id,
            connection_status: data[0].connection_status || 'disconnected',
            phone_number: data[0].phone_number,
            is_enabled: data[0].is_enabled,
          });
        } else {
          setWhatsappConfig(null);
        }
      } catch {
        setWhatsappConfig(null);
      } finally {
        setLoadingWhatsapp(false);
      }
    };
    
    fetchWhatsappConfig();
  }, [open, channelType, currentTenant?.id]);

  const handleSave = async () => {
    if (!channel) return;
    setSaving(true);
    
    try {
      const { error } = await supabase
        .from('channel_accounts')
        .update({
          metadata: config as Record<string, never>,
          credentials: config as Record<string, never>,
        })
        .eq('id', channel.id);

      if (error) throw error;
      
      toast.success('Configuração salva');
      onSave();
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving channel config:', error);
      toast.error('Erro ao salvar configuração');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    // TODO: Implement connection test for each channel type
    setTimeout(() => {
      toast.info('Teste de conexão em desenvolvimento');
      setTesting(false);
    }, 1000);
  };

  const updateConfig = (key: keyof ChannelConfig, value: string) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const toggleSecret = (key: string) => {
    setShowSecrets(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const renderSecretInput = (key: keyof ChannelConfig, label: string, placeholder: string) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="relative">
        <Input
          type={showSecrets[key] ? 'text' : 'password'}
          placeholder={placeholder}
          value={config[key] || ''}
          onChange={(e) => updateConfig(key, e.target.value)}
          className="pr-10"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
          onClick={() => toggleSecret(key)}
        >
          {showSecrets[key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );

  const docs = channelDocs[channelType];

  // Special handling for WhatsApp - uses existing whatsapp_configs
  const renderWhatsAppConfig = () => {
    if (loadingWhatsapp) {
      return <div className="text-sm text-muted-foreground">Carregando configuração...</div>;
    }

    if (whatsappConfig) {
      const isConnected = whatsappConfig.connection_status === 'connected';
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 border rounded-lg bg-muted/30">
            <div className={`p-2 rounded-full ${isConnected ? 'bg-green-100 dark:bg-green-900/30' : 'bg-yellow-100 dark:bg-yellow-900/30'}`}>
              {isConnected ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <Link2 className="h-5 w-5 text-yellow-600" />
              )}
            </div>
            <div className="flex-1">
              <p className="font-medium">
                {isConnected ? 'WhatsApp Conectado' : 'WhatsApp Configurado'}
              </p>
              {whatsappConfig.phone_number && (
                <p className="text-sm text-muted-foreground">{whatsappConfig.phone_number}</p>
              )}
              <p className="text-xs text-muted-foreground capitalize">
                Status: {whatsappConfig.connection_status}
              </p>
            </div>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              As credenciais do WhatsApp são gerenciadas em <strong>Integrações → WhatsApp</strong>. 
              Este canal de atendimento usa automaticamente essa configuração.
            </AlertDescription>
          </Alert>

          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              navigate('/integrations');
            }}
            className="w-full"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Gerenciar WhatsApp nas Integrações
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <Info className="h-4 w-4" />
          <AlertDescription>
            Nenhuma configuração de WhatsApp encontrada. Configure primeiro em <strong>Integrações → WhatsApp</strong>.
          </AlertDescription>
        </Alert>

        <Button
          onClick={() => {
            onOpenChange(false);
            navigate('/integrations');
          }}
          className="w-full"
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          Ir para Integrações
        </Button>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurar {channel?.account_name}</DialogTitle>
          <DialogDescription>
            {channelType === 'whatsapp' 
              ? 'Vinculação com WhatsApp existente'
              : 'Configure as credenciais de integração para este canal'
            }
          </DialogDescription>
        </DialogHeader>

        {channelType !== 'whatsapp' && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm">
              {docs.instructions}
              {docs.url && (
                <a 
                  href={docs.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-primary hover:underline mt-1"
                >
                  Acessar documentação <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4 py-4">
          {channelType === 'whatsapp' && renderWhatsAppConfig()}

          {channelType === 'email' && (
            <Tabs defaultValue="imap">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="imap">IMAP (Receber)</TabsTrigger>
                <TabsTrigger value="smtp">SMTP (Enviar)</TabsTrigger>
              </TabsList>
              <TabsContent value="imap" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    placeholder="suporte@sualoja.com"
                    value={config.email_address || ''}
                    onChange={(e) => updateConfig('email_address', e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Servidor IMAP</Label>
                    <Input
                      placeholder="imap.gmail.com"
                      value={config.imap_host || ''}
                      onChange={(e) => updateConfig('imap_host', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Porta</Label>
                    <Input
                      placeholder="993"
                      value={config.imap_port || ''}
                      onChange={(e) => updateConfig('imap_port', e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Usuário</Label>
                  <Input
                    placeholder="suporte@sualoja.com"
                    value={config.imap_user || ''}
                    onChange={(e) => updateConfig('imap_user', e.target.value)}
                  />
                </div>
                {renderSecretInput('imap_password', 'Senha / App Password', 'Senha ou senha de app')}
              </TabsContent>
              <TabsContent value="smtp" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Servidor SMTP</Label>
                    <Input
                      placeholder="smtp.gmail.com"
                      value={config.smtp_host || ''}
                      onChange={(e) => updateConfig('smtp_host', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Porta</Label>
                    <Input
                      placeholder="587"
                      value={config.smtp_port || ''}
                      onChange={(e) => updateConfig('smtp_port', e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Usuário</Label>
                  <Input
                    placeholder="suporte@sualoja.com"
                    value={config.smtp_user || ''}
                    onChange={(e) => updateConfig('smtp_user', e.target.value)}
                  />
                </div>
                {renderSecretInput('smtp_password', 'Senha / App Password', 'Senha ou senha de app')}
              </TabsContent>
            </Tabs>
          )}

          {(channelType === 'facebook_messenger' || channelType === 'instagram_dm') && (
            <>
              <div className="space-y-2">
                <Label>Page ID / Instagram ID</Label>
                <Input
                  placeholder="ID da sua página"
                  value={config.page_id || ''}
                  onChange={(e) => updateConfig('page_id', e.target.value)}
                />
              </div>
              {renderSecretInput('page_access_token', 'Page Access Token', 'Token de acesso da página')}
              <div className="space-y-2">
                <Label>App ID</Label>
                <Input
                  placeholder="ID do seu app Meta"
                  value={config.app_id || ''}
                  onChange={(e) => updateConfig('app_id', e.target.value)}
                />
              </div>
              {renderSecretInput('app_secret', 'App Secret', 'Chave secreta do app')}
            </>
          )}

          {channelType === 'mercadolivre' && (
            meliLoading ? (
              <div className="text-sm text-muted-foreground">Verificando integração...</div>
            ) : meliConnected ? (
              // ML connected - show config from integration
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 border rounded-lg bg-muted/30">
                  <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/30">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">Mercado Livre Conectado</p>
                    {meliConnection?.externalUsername && (
                      <p className="text-sm text-muted-foreground">@{meliConnection.externalUsername}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Conta vinculada via Marketplaces
                    </p>
                  </div>
                </div>

                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    As credenciais do Mercado Livre são gerenciadas em <strong>Marketplaces</strong>. 
                    Este canal de atendimento usa automaticamente essa configuração.
                  </AlertDescription>
                </Alert>

                <Button
                  variant="outline"
                  onClick={() => {
                    onOpenChange(false);
                    navigate('/marketplaces');
                  }}
                  className="w-full"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Gerenciar em Marketplaces
                </Button>
              </div>
            ) : (
              // ML not connected - show integration required alert
              <IntegrationRequiredAlert
                integrationName="Mercado Livre"
                description="para configurar o canal de atendimento"
                integrationPath="/marketplaces"
                buttonText="Conectar Mercado Livre"
                icon={ShoppingCart}
              />
            )
          )}

          {channelType === 'shopee' && (
            <>
              <div className="space-y-2">
                <Label>Partner ID</Label>
                <Input
                  placeholder="ID de parceiro Shopee"
                  value={config.shopee_partner_id || ''}
                  onChange={(e) => updateConfig('shopee_partner_id', e.target.value)}
                />
              </div>
              {renderSecretInput('shopee_partner_key', 'Partner Key', 'Chave de parceiro')}
              <div className="space-y-2">
                <Label>Shop ID</Label>
                <Input
                  placeholder="ID da sua loja"
                  value={config.shopee_shop_id || ''}
                  onChange={(e) => updateConfig('shopee_shop_id', e.target.value)}
                />
              </div>
              {renderSecretInput('shopee_access_token', 'Access Token', 'Token de acesso')}
            </>
          )}
        </div>

        {channelType !== 'whatsapp' && channelType !== 'mercadolivre' && (
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleTest} disabled={testing}>
              {testing ? 'Testando...' : 'Testar conexão'}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
