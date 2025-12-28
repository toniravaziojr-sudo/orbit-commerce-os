import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Settings, Trash2, CheckCircle, XCircle, AlertCircle, ExternalLink } from "lucide-react";
import { useChannelAccounts, type ChannelAccount } from "@/hooks/useChannelAccounts";
import type { SupportChannelType } from "@/hooks/useConversations";
import { Skeleton } from "@/components/ui/skeleton";

const channelInfo: Record<SupportChannelType, { name: string; icon: string; description: string; docsUrl: string }> = {
  whatsapp: {
    name: 'WhatsApp',
    icon: '💬',
    description: 'Receba e responda mensagens do WhatsApp Business',
    docsUrl: '/integrations#whatsapp',
  },
  email: {
    name: 'Email',
    icon: '✉️',
    description: 'Receba e responda emails de suporte',
    docsUrl: '/integrations#email',
  },
  facebook_messenger: {
    name: 'Messenger',
    icon: '📘',
    description: 'Atenda pelo Facebook Messenger',
    docsUrl: 'https://developers.facebook.com/docs/messenger-platform',
  },
  instagram_dm: {
    name: 'Instagram DM',
    icon: '📸',
    description: 'Responda mensagens diretas do Instagram',
    docsUrl: 'https://developers.facebook.com/docs/instagram-api',
  },
  mercadolivre: {
    name: 'Mercado Livre',
    icon: '🛒',
    description: 'Responda perguntas e mensagens de pedidos',
    docsUrl: 'https://developers.mercadolivre.com.br',
  },
  shopee: {
    name: 'Shopee',
    icon: '🧡',
    description: 'Atenda no chat da Shopee',
    docsUrl: 'https://open.shopee.com',
  },
};

export function ChannelIntegrations() {
  const { channels, isLoading, createChannel, updateChannel, deleteChannel } = useChannelAccounts();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<SupportChannelType | ''>('');
  const [accountName, setAccountName] = useState('');

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

  const getChannelStatus = (channel: ChannelAccount) => {
    if (channel.last_error) return 'error';
    if (channel.is_active && channel.last_sync_at) return 'connected';
    if (channel.is_active) return 'pending';
    return 'disabled';
  };

  const statusConfig = {
    connected: { label: 'Conectado', icon: CheckCircle, color: 'text-green-600' },
    pending: { label: 'Pendente', icon: AlertCircle, color: 'text-yellow-600' },
    error: { label: 'Erro', icon: XCircle, color: 'text-red-600' },
    disabled: { label: 'Desativado', icon: XCircle, color: 'text-gray-400' },
  };

  if (isLoading) {
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
            Configure os canais onde a IA vai atender seus clientes
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Canal
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Canal</DialogTitle>
              <DialogDescription>
                Escolha o canal que deseja integrar ao atendimento
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
                    {(Object.keys(channelInfo) as SupportChannelType[]).map((type) => {
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
                  placeholder="Ex: WhatsApp Principal"
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
      </div>

      {/* Available Channels */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {(Object.keys(channelInfo) as SupportChannelType[]).map((type) => {
          const info = channelInfo[type];
          const channel = channels.find(c => c.channel_type === type);
          const status = channel ? getChannelStatus(channel) : null;
          const statusInfo = status ? statusConfig[status] : null;

          return (
            <Card key={type} className={channel?.is_active ? 'border-primary/50' : ''}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <span className="text-2xl">{info.icon}</span>
                    {info.name}
                  </CardTitle>
                  {statusInfo && (
                    <div className={`flex items-center gap-1 text-sm ${statusInfo.color}`}>
                      <statusInfo.icon className="h-4 w-4" />
                      <span>{statusInfo.label}</span>
                    </div>
                  )}
                </div>
                <CardDescription>{info.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {channel ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{channel.account_name}</span>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={channel.is_active}
                          onCheckedChange={(checked) => updateChannel.mutate({ id: channel.id, is_active: checked })}
                        />
                      </div>
                    </div>
                    {channel.last_error && (
                      <p className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 p-2 rounded">
                        {channel.last_error}
                      </p>
                    )}
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" className="flex-1">
                        <Settings className="h-4 w-4 mr-1" />
                        Configurar
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
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          setSelectedType(type);
                          setAccountName(`${info.name} Principal`);
                          setIsAddDialogOpen(true);
                        }}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Adicionar
                      </Button>
                      <Button variant="ghost" size="sm" asChild>
                        <a href={info.docsUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
