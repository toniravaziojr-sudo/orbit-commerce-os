import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExternalLink, Eye, EyeOff, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { ChannelAccount } from "@/hooks/useChannelAccounts";
import type { SupportChannelType } from "@/hooks/useConversations";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ChannelConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channel: ChannelAccount | null;
  channelType: SupportChannelType;
  onSave: () => void;
}

interface ChannelConfig {
  // WhatsApp (Z-API)
  instance_id?: string;
  instance_token?: string;
  client_token?: string;
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

const channelDocs: Record<SupportChannelType, { url: string; instructions: string }> = {
  whatsapp: {
    url: 'https://developer.z-api.io',
    instructions: 'Acesse o painel Z-API para obter as credenciais da sua instância. Você precisará do Instance ID, Instance Token e Client Token.',
  },
  email: {
    url: '',
    instructions: 'Configure as credenciais IMAP/SMTP do seu servidor de email. Use Gmail, Outlook ou seu próprio servidor.',
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
};

export function ChannelConfigDialog({
  open,
  onOpenChange,
  channel,
  channelType,
  onSave,
}: ChannelConfigDialogProps) {
  const [config, setConfig] = useState<ChannelConfig>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (channel?.metadata) {
      setConfig((channel.metadata as ChannelConfig) || {});
    } else {
      setConfig({});
    }
  }, [channel]);

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurar {channel?.account_name}</DialogTitle>
          <DialogDescription>
            Configure as credenciais de integração para este canal
          </DialogDescription>
        </DialogHeader>

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

        <div className="space-y-4 py-4">
          {channelType === 'whatsapp' && (
            <>
              <div className="space-y-2">
                <Label>Instance ID</Label>
                <Input
                  placeholder="Sua instância Z-API"
                  value={config.instance_id || ''}
                  onChange={(e) => updateConfig('instance_id', e.target.value)}
                />
              </div>
              {renderSecretInput('instance_token', 'Instance Token', 'Token da instância')}
              {renderSecretInput('client_token', 'Client Token', 'Token do cliente Z-API')}
            </>
          )}

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
            <>
              <div className="space-y-2">
                <Label>Client ID</Label>
                <Input
                  placeholder="ID da aplicação ML"
                  value={config.ml_client_id || ''}
                  onChange={(e) => updateConfig('ml_client_id', e.target.value)}
                />
              </div>
              {renderSecretInput('ml_client_secret', 'Client Secret', 'Chave secreta da aplicação')}
              <div className="space-y-2">
                <Label>User ID</Label>
                <Input
                  placeholder="Seu ID de vendedor"
                  value={config.ml_user_id || ''}
                  onChange={(e) => updateConfig('ml_user_id', e.target.value)}
                />
              </div>
              {renderSecretInput('ml_access_token', 'Access Token', 'Token de acesso OAuth')}
              {renderSecretInput('ml_refresh_token', 'Refresh Token', 'Token para renovação')}
            </>
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

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleTest} disabled={testing}>
            {testing ? 'Testando...' : 'Testar conexão'}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
