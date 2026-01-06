import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  MessageSquare, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink, 
  Info, 
  Shield, 
  RefreshCw, 
  Loader2, 
  Users,
  Plus,
  Pencil,
  Trash2,
  Phone
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CredentialEditor } from "./CredentialEditor";

interface WhatsAppInstance {
  id: string;
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
  instance_id_preview: string | null;
  has_credentials: boolean;
  connection_status: string;
  phone_number: string | null;
  is_enabled: boolean;
  last_connected_at: string | null;
  last_error: string | null;
}

interface Tenant {
  id: string;
  name: string;
  slug: string;
}

export function WhatsAppPlatformSettings() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingInstance, setEditingInstance] = useState<WhatsAppInstance | null>(null);
  const [formData, setFormData] = useState({
    tenant_id: '',
    instance_id: '',
    instance_token: '',
    client_token: '',
  });

  // Fetch platform secret status
  const { data: secretStatus, isLoading: isLoadingSecrets } = useQuery({
    queryKey: ['platform-secrets-status', 'zapi'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      const response = await supabase.functions.invoke('platform-secrets-check', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) throw response.error;
      if (!response.data.success) throw new Error(response.data.error);
      
      const zapi = response.data.integrations?.find((i: any) => i.key === 'zapi');
      return zapi || null;
    },
  });

  // Fetch all instances
  const { data: instancesData, isLoading: isLoadingInstances } = useQuery({
    queryKey: ['whatsapp-admin-instances'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      const response = await supabase.functions.invoke('whatsapp-admin-instances', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) throw response.error;
      if (!response.data.success) throw new Error(response.data.error);
      
      return response.data.instances as WhatsAppInstance[];
    },
  });

  // Fetch all tenants for dropdown
  const { data: tenants } = useQuery({
    queryKey: ['tenants-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenants')
        .select('id, name, slug')
        .order('name');
      
      if (error) throw error;
      return data as Tenant[];
    },
  });

  // Save instance mutation
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      const response = await supabase.functions.invoke('whatsapp-admin-instances', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: data,
      });

      if (response.error) throw response.error;
      if (!response.data.success) throw new Error(response.data.error);
      
      return response.data;
    },
    onSuccess: () => {
      toast.success('Instância salva com sucesso');
      queryClient.invalidateQueries({ queryKey: ['whatsapp-admin-instances'] });
      setIsDialogOpen(false);
      setEditingInstance(null);
      setFormData({ tenant_id: '', instance_id: '', instance_token: '', client_token: '' });
    },
    onError: (error: Error) => {
      toast.error('Erro ao salvar instância', { description: error.message });
    },
  });

  // Delete instance mutation
  const deleteMutation = useMutation({
    mutationFn: async (tenantId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      const response = await supabase.functions.invoke('whatsapp-admin-instances', {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: { tenant_id: tenantId },
      });

      if (response.error) throw response.error;
      if (!response.data.success) throw new Error(response.data.error);
      
      return response.data;
    },
    onSuccess: () => {
      toast.success('Instância removida');
      queryClient.invalidateQueries({ queryKey: ['whatsapp-admin-instances'] });
    },
    onError: (error: Error) => {
      toast.error('Erro ao remover instância', { description: error.message });
    },
  });

  const handleOpenDialog = (instance?: WhatsAppInstance) => {
    if (instance) {
      setEditingInstance(instance);
      setFormData({
        tenant_id: instance.tenant_id,
        instance_id: '', // Don't prefill for security
        instance_token: '',
        client_token: '',
      });
    } else {
      setEditingInstance(null);
      setFormData({ tenant_id: '', instance_id: '', instance_token: '', client_token: '' });
    }
    setIsDialogOpen(true);
  };

  const handleDelete = (instance: WhatsAppInstance) => {
    if (confirm(`Remover instância WhatsApp de "${instance.tenant_name}"?`)) {
      deleteMutation.mutate(instance.tenant_id);
    }
  };

  const instances = instancesData || [];
  const stats = {
    totalInstances: instances.length,
    connected: instances.filter(i => i.connection_status === 'connected').length,
    disconnected: instances.filter(i => i.connection_status === 'disconnected').length,
    pending: instances.filter(i => i.connection_status === 'qr_pending').length,
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20"><CheckCircle2 className="h-3 w-3 mr-1" />Conectado</Badge>;
      case 'qr_pending':
        return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Aguardando QR</Badge>;
      default:
        return <Badge variant="outline" className="text-muted-foreground"><AlertCircle className="h-3 w-3 mr-1" />Desconectado</Badge>;
    }
  };

  // Format phone number for display
  const formatPhone = (phone: string | null) => {
    if (!phone) return '—';
    // Simple formatting: +55 11 99999-9999
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 13) {
      return `+${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 9)}-${digits.slice(9)}`;
    }
    if (digits.length === 12) {
      return `+${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 8)}-${digits.slice(8)}`;
    }
    return phone;
  };

  const isLoading = isLoadingSecrets || isLoadingInstances;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-lg bg-green-500/10">
          <MessageSquare className="h-6 w-6 text-green-600" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">WhatsApp (Z-API)</h2>
          <p className="text-sm text-muted-foreground">
            Conta gerenciadora centralizada para todos os tenants
          </p>
        </div>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Você gerencia a conta Z-API central. Cada tenant conecta seu próprio WhatsApp via QR Code usando a instância que você provisionar aqui.
        </AlertDescription>
      </Alert>

      {/* Credencial da Plataforma - Client Token */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5" />
              <div>
                <CardTitle className="text-base">Credencial Z-API (Plataforma)</CardTitle>
                <CardDescription>
                  Client Token da sua conta Z-API gerenciadora
                </CardDescription>
              </div>
            </div>
            {secretStatus?.status === 'configured' ? (
              <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Configurado
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground">
                <AlertCircle className="h-3 w-3 mr-1" />
                Pendente
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <CredentialEditor
            credentialKey="ZAPI_CLIENT_TOKEN"
            label="Client Token"
            description="Token de autenticação da sua conta Z-API (comum a todas as instâncias)"
            isConfigured={secretStatus?.secrets?.ZAPI_CLIENT_TOKEN || false}
            preview={secretStatus?.previews?.ZAPI_CLIENT_TOKEN}
            source={secretStatus?.sources?.ZAPI_CLIENT_TOKEN as 'db' | 'env' | null}
            placeholder="Cole o Client Token aqui..."
          />
        </CardContent>
      </Card>

      {/* Gerenciamento de Instâncias */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5" />
              <div>
                <CardTitle className="text-base">Instâncias de Tenants</CardTitle>
                <CardDescription>
                  Instâncias Z-API criadas automaticamente quando os tenants habilitam WhatsApp
                </CardDescription>
              </div>
            </div>
            {/* Removed manual creation button - instances are auto-provisioned */}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-4">
            <div className="p-4 rounded-lg border bg-muted/30 text-center">
              <p className="text-2xl font-bold">{stats.totalInstances}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
            <div className="p-4 rounded-lg border bg-green-500/10 text-center">
              <p className="text-2xl font-bold text-green-600">{stats.connected}</p>
              <p className="text-xs text-muted-foreground">Conectadas</p>
            </div>
            <div className="p-4 rounded-lg border bg-destructive/10 text-center">
              <p className="text-2xl font-bold text-destructive">{stats.disconnected}</p>
              <p className="text-xs text-muted-foreground">Desconectadas</p>
            </div>
            <div className="p-4 rounded-lg border bg-yellow-500/10 text-center">
              <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
              <p className="text-xs text-muted-foreground">Aguardando QR</p>
            </div>
          </div>

          <Separator />

          {/* Instances Table */}
          {instances.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nenhuma instância provisionada</p>
              <p className="text-sm">As instâncias são criadas automaticamente quando os tenants habilitam WhatsApp em Integrações</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Instance ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {instances.map((instance) => (
                  <TableRow key={instance.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{instance.tenant_name}</p>
                        <p className="text-xs text-muted-foreground">{instance.tenant_slug}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {instance.instance_id_preview || '—'}
                      </code>
                    </TableCell>
                    <TableCell>{getStatusBadge(instance.connection_status)}</TableCell>
                    <TableCell>
                      {instance.phone_number ? (
                        <span className="flex items-center gap-1 text-sm">
                          <Phone className="h-3 w-3" />
                          {formatPhone(instance.phone_number)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(instance)}
                        disabled={deleteMutation.isPending}
                        title="Remover instância"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Como funciona */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Como funciona</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">1.</span>
              Configure o Client Token da sua conta Z-API acima
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">2.</span>
              O tenant acessa Integrações → WhatsApp e clica em "Habilitar WhatsApp"
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">3.</span>
              O sistema cria automaticamente uma instância Z-API para o tenant
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">4.</span>
              O tenant escaneia o QR Code com seu WhatsApp
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">5.</span>
              Pronto! O WhatsApp do tenant está conectado e recebendo mensagens
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Links */}
      <div className="flex gap-3">
        <Button variant="outline" asChild>
          <a href="https://developer.z-api.io/" target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4 mr-2" />
            Documentação Z-API
          </a>
        </Button>
        <Button variant="outline" asChild>
          <a href="https://painel.z-api.io/" target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4 mr-2" />
            Painel Z-API
          </a>
        </Button>
      </div>

    </div>
  );
}
