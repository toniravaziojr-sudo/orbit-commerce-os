import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Plus, Settings, Trash2, CheckCircle, XCircle, AlertCircle, ExternalLink, Bot, ShoppingCart } from "lucide-react";
import { useChannelAccounts, type ChannelAccount } from "@/hooks/useChannelAccounts";
import type { SupportChannelType } from "@/hooks/useConversations";
import { Skeleton } from "@/components/ui/skeleton";
import { ChannelConfigDialog } from "./ChannelConfigDialog";
import { AIChannelConfigDialog } from "./AIChannelConfigDialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenantType } from "@/hooks/useTenantType";
import { useNavigate } from "react-router-dom";
import { useMeliConnection } from "@/hooks/useMeliConnection";
import { IntegrationRequiredAlert } from "@/components/ui/integration-required-alert";

interface IntegrationStatus {
  whatsapp: { configured: boolean; connected: boolean; phone?: string };
  email: { configured: boolean; verified: boolean; from?: string };
  mercadolivre: { configured: boolean; connected: boolean; username?: string };
}

const channelInfo: Record<SupportChannelType, { name: string; icon: string; description: string; integrationPath: string }> = {
  whatsapp: {
    name: 'WhatsApp',
    icon: '💬',
    description: 'Receba e responda mensagens do WhatsApp Business',
    integrationPath: '/integrations#whatsapp',
  },
  email: {
    name: 'Email',
    icon: '✉️',
    description: 'Receba e responda emails de suporte',
    integrationPath: '/emails',
  },
  facebook_messenger: {
    name: 'Messenger',
    icon: '📘',
    description: 'Atenda pelo Facebook Messenger',
    integrationPath: '',
  },
  instagram_dm: {
    name: 'Instagram DM',
    icon: '📸',
    description: 'Responda mensagens diretas do Instagram',
    integrationPath: '',
  },
  mercadolivre: {
    name: 'Mercado Livre',
    icon: '🛒',
    description: 'Responda perguntas e mensagens de pedidos',
    integrationPath: '',
  },
  shopee: {
    name: 'Shopee',
    icon: '🧡',
    description: 'Atenda no chat da Shopee',
    integrationPath: '',
  },
  tiktokshop: {
    name: 'TikTok Shop',
    icon: '🎵',
    description: 'Responda mensagens e perguntas do TikTok Shop',
    integrationPath: '/integrations?tab=tiktok',
  },
  chat: {
    name: 'Chat do Site',
    icon: '🌐',
    description: 'Chat widget integrado na loja virtual',
    integrationPath: '',
  },
};

// Canais que usam integrações existentes (não precisam de config própria)
const linkedChannels: SupportChannelType[] = ['whatsapp', 'email'];

// Canais disponíveis para o tenant plataforma (admin) - sem marketplaces
const PLATFORM_TENANT_CHANNELS: SupportChannelType[] = ['whatsapp', 'email', 'facebook_messenger', 'instagram_dm'];

export function ChannelIntegrations() {
  const { currentTenant } = useAuth();
  const { isPlatformTenant } = useTenantType();
  const navigate = useNavigate();
  const { channels, isLoading, createChannel, updateChannel, deleteChannel } = useChannelAccounts();
  const { isConnected: meliConnected, isLoading: meliLoading, connection: meliConnection } = useMeliConnection();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<SupportChannelType | ''>('');
  const [accountName, setAccountName] = useState('');
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<ChannelAccount | null>(null);
  const [selectedChannelType, setSelectedChannelType] = useState<SupportChannelType>('whatsapp');
  const [aiConfigOpen, setAiConfigOpen] = useState(false);
  const [aiConfigChannel, setAiConfigChannel] = useState<{ type: SupportChannelType; name: string } | null>(null);
  const [integrationStatus, setIntegrationStatus] = useState<IntegrationStatus>({
    whatsapp: { configured: false, connected: false },
    email: { configured: false, verified: false },
    mercadolivre: { configured: false, connected: false },
  });
  const [loadingStatus, setLoadingStatus] = useState(true);

  // Fetch integration status from existing configs
  useEffect(() => {
    const fetchIntegrationStatus = async () => {
      if (!currentTenant?.id) return;
      
      setLoadingStatus(true);
      try {
        // Check WhatsApp config
        const { data: waData } = await supabase.rpc('get_whatsapp_config_for_tenant', { 
          p_tenant_id: currentTenant.id 
        });
        
        // Check Email config
        const { data: emailData } = await supabase
          .from('email_provider_configs')
          .select('id, verification_status, from_email, from_name')
          .eq('tenant_id', currentTenant.id)
          .maybeSingle();

        setIntegrationStatus({
          whatsapp: {
            configured: !!waData && waData.length > 0,
            connected: waData?.[0]?.connection_status === 'connected',
            phone: waData?.[0]?.phone_number || undefined,
          },
          email: {
            configured: !!emailData,
            verified: emailData?.verification_status === 'verified',
            from: emailData?.from_email || emailData?.from_name || undefined,
          },
          mercadolivre: {
            configured: meliConnected,
            connected: meliConnected,
            username: meliConnection?.externalUsername || undefined,
          },
        });
      } catch (error) {
        console.error('Error fetching integration status:', error);
      } finally {
        setLoadingStatus(false);
      }
    };

    fetchIntegrationStatus();
  }, [currentTenant?.id, meliConnected, meliConnection]);

  const handleAddChannel = () => {
    if (!selectedType || !accountName) return;
    createChannel.mutate({
      channel_type: selectedType,
      account_name: accountName,
    }, {
      onSuccess: () => {
        setIsAddDialogOpen(false);
        setSelectedType('');
        setAccountName('');
      },
    });
  };

  const handleOpenConfig = (channel: ChannelAccount) => {
    setSelectedChannel(channel);
    setSelectedChannelType(channel.channel_type);
    setConfigDialogOpen(true);
  };

  const isIntegrationReady = (type: SupportChannelType): boolean => {
    if (type === 'whatsapp') return integrationStatus.whatsapp.configured;
    if (type === 'email') return integrationStatus.email.configured;
    if (type === 'mercadolivre') return integrationStatus.mercadolivre.configured;
    return true; // Other channels manage their own config
  };

  const getIntegrationPath = (type: SupportChannelType): string => {
    if (type === 'whatsapp') return '/integrations';
    if (type === 'email') return '/emails';
    if (type === 'mercadolivre') return '/marketplaces';
    return '';
  };

  const getIntegrationLabel = (type: SupportChannelType): string | null => {
    if (type === 'whatsapp' && integrationStatus.whatsapp.configured) {
      return integrationStatus.whatsapp.phone || (integrationStatus.whatsapp.connected ? 'Conectado' : 'Configurado');
    }
    if (type === 'email' && integrationStatus.email.configured) {
      return integrationStatus.email.from || (integrationStatus.email.verified ? 'Verificado' : 'Configurado');
    }
    if (type === 'mercadolivre' && integrationStatus.mercadolivre.configured) {
      return integrationStatus.mercadolivre.username || 'Conectado';
    }
    return null;
  };

  // Canais que usam integrações externas (não WhatsApp/Email que já estão no linkedChannels)
  const marketplaceChannels: SupportChannelType[] = ['mercadolivre', 'shopee', 'tiktokshop'];

  if (isLoading || loadingStatus || meliLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Canais de Atendimento</h2>
          <p className="text-sm text-muted-foreground">
            Ative os canais onde a IA vai atender seus clientes
          </p>
        </div>
      </div>

      {/* Info about AI requirements */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-4">
        <div className="flex gap-3">
          <Bot className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              Requisitos para IA por canal
            </p>
            <ul className="text-sm text-amber-700 dark:text-amber-300 space-y-1 list-disc list-inside">
              <li><strong>WhatsApp:</strong> Conexão via QR Code em Integrações</li>
              <li><strong>Email:</strong> Configure o recebimento de emails (MX) na aba Emails → Configurações</li>
              <li><strong>Outros canais:</strong> Configure as credenciais específicas de cada plataforma</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Channels Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {(Object.keys(channelInfo) as SupportChannelType[])
          .filter((type) => isPlatformTenant ? PLATFORM_TENANT_CHANNELS.includes(type) : true)
          .map((type) => {
          const info = channelInfo[type];
          const channel = channels.find(c => c.channel_type === type);
          const isLinkedChannel = linkedChannels.includes(type);
          const integrationReady = isIntegrationReady(type);
          const integrationLabel = getIntegrationLabel(type);

          return (
            <Card key={type} className={channel?.is_active ? 'border-primary/50' : ''}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <span className="text-2xl">{info.icon}</span>
                    {info.name}
                  </CardTitle>
                  {channel?.is_active && (
                    <Badge variant="default" className="bg-green-600">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Ativo
                    </Badge>
                  )}
                </div>
                <CardDescription>{info.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {isLinkedChannel ? (
                  // WhatsApp and Email - use existing integrations
                  integrationReady ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div>
                          <p className="text-sm font-medium">
                            {integrationLabel || 'Integração configurada'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Via Integrações
                          </p>
                        </div>
                        <Switch
                          checked={channel?.is_active || false}
                          onCheckedChange={(checked) => {
                            if (channel) {
                              updateChannel.mutate({ id: channel.id, is_active: checked });
                            } else {
                              // Create channel and activate
                              createChannel.mutate({
                                channel_type: type,
                                account_name: `${info.name} Principal`,
                              });
                            }
                          }}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="flex-1 text-muted-foreground"
                          onClick={() => navigate(type === 'email' ? '/emails' : '/integrations')}
                        >
                          <Settings className="h-4 w-4 mr-2" />
                          {type === 'email' ? 'Gerenciar em Emails' : 'Gerenciar em Integrações'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setAiConfigChannel({ type, name: channelInfo[type].name });
                            setAiConfigOpen(true);
                          }}
                        >
                          <Bot className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                        <AlertCircle className="h-5 w-5 text-yellow-600" />
                        <p className="text-sm text-yellow-800 dark:text-yellow-200">
                          Configure primeiro em Integrações
                        </p>
                      </div>
                      <Button 
                        onClick={() => navigate(type === 'email' ? '/emails' : '/integrations')}
                        className="w-full"
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Configurar {info.name}
                      </Button>
                    </div>
                  )
                ) : marketplaceChannels.includes(type) ? (
                  // Marketplace channels - need integration first
                  integrationReady ? (
                    // Integration ready - show config
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div>
                          <p className="text-sm font-medium">
                            {integrationLabel || 'Integração conectada'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Via Marketplaces
                          </p>
                        </div>
                        <Switch
                          checked={channel?.is_active || false}
                          onCheckedChange={(checked) => {
                            if (channel) {
                              updateChannel.mutate({ id: channel.id, is_active: checked });
                            } else {
                              createChannel.mutate({
                                channel_type: type,
                                account_name: `${info.name} Principal`,
                              });
                            }
                          }}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="flex-1 text-muted-foreground"
                          onClick={() => navigate('/marketplaces')}
                        >
                          <Settings className="h-4 w-4 mr-2" />
                          Gerenciar em Marketplaces
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setAiConfigChannel({ type, name: channelInfo[type].name });
                            setAiConfigOpen(true);
                          }}
                        >
                          <Bot className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    // Integration not ready - show alert
                    <IntegrationRequiredAlert
                      integrationName={info.name}
                      description="para ativar o canal de atendimento"
                      integrationPath="/marketplaces"
                      buttonText="Conectar Mercado Livre"
                      icon={ShoppingCart}
                    />
                  )
                ) : (
                  // Other channels - manage their own config
                  channel ? (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">{channel.account_name}</span>
                        <Switch
                          checked={channel.is_active}
                          onCheckedChange={(checked) => updateChannel.mutate({ id: channel.id, is_active: checked })}
                        />
                      </div>
                      {channel.last_error && (
                        <p className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 p-2 rounded">
                          {channel.last_error}
                        </p>
                      )}
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="flex-1"
                          onClick={() => handleOpenConfig(channel)}
                        >
                          <Settings className="h-4 w-4 mr-1" />
                          Configurar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setAiConfigChannel({ type, name: channelInfo[type].name });
                            setAiConfigOpen(true);
                          }}
                        >
                          <Bot className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteChannel.mutate(channel.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-3">
                      <Badge variant="outline">Não configurado</Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => {
                          setSelectedType(type);
                          setAccountName(`${info.name} Principal`);
                          setIsAddDialogOpen(true);
                        }}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Adicionar
                      </Button>
                    </div>
                  )
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Add Channel Dialog (for non-linked channels) */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Canal</DialogTitle>
            <DialogDescription>
              Configure as credenciais do canal
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Canal</Label>
              <Select value={selectedType} onValueChange={(v) => setSelectedType(v as SupportChannelType)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um canal" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(channelInfo) as SupportChannelType[])
                    .filter(type => !linkedChannels.includes(type))
                    .map((type) => {
                      const info = channelInfo[type];
                      const exists = channels.some(c => c.channel_type === type);
                      return (
                        <SelectItem key={type} value={type} disabled={exists}>
                          <div className="flex items-center gap-2">
                            <span>{info.icon}</span>
                            <span>{info.name}</span>
                            {exists && <Badge variant="secondary" className="ml-2">Já adicionado</Badge>}
                          </div>
                        </SelectItem>
                      );
                    })}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nome da Conta</Label>
              <Input
                placeholder="Ex: Messenger Principal"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddChannel} disabled={!selectedType || !accountName || createChannel.isPending}>
              {createChannel.isPending ? 'Adicionando...' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Channel Config Dialog (for non-linked channels only) */}
      <ChannelConfigDialog
        open={configDialogOpen}
        onOpenChange={setConfigDialogOpen}
        channel={selectedChannel}
        channelType={selectedChannelType}
        onSave={() => {}}
      />

      {/* AI Channel Config Dialog */}
      <AIChannelConfigDialog
        open={aiConfigOpen}
        onOpenChange={setAiConfigOpen}
        channelType={aiConfigChannel?.type || 'whatsapp'}
        channelName={aiConfigChannel?.name || 'Canal'}
      />
    </div>
  );
}
