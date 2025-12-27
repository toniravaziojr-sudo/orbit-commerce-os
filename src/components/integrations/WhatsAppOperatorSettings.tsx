import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  MessageCircle, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  Save,
  Shield,
  Smartphone,
  Trash2,
  Settings,
  Wifi
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Tenant {
  id: string;
  name: string;
  slug: string;
}

interface WhatsAppConfig {
  id?: string;
  tenant_id: string;
  instance_id: string;
  instance_token: string;
  client_token: string;
  connection_status: string;
  phone_number: string | null;
  is_enabled: boolean;
  last_connected_at: string | null;
  last_error: string | null;
}

/**
 * Component for platform operators to manage WhatsApp credentials per tenant.
 * This is only visible to platform admins (respeiteohomem@gmail.com).
 * Tenants never see these credentials - they only see a "Connect" button with QR.
 */
export function WhatsAppOperatorSettings() {
  const { toast } = useToast();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>("");
  
  const [instanceId, setInstanceId] = useState("");
  const [instanceToken, setInstanceToken] = useState("");
  const [clientToken, setClientToken] = useState("");
  const [config, setConfig] = useState<WhatsAppConfig | null>(null);

  // Fetch all tenants
  useEffect(() => {
    const fetchTenants = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from("tenants")
          .select("id, name, slug")
          .order("name");

        if (error) throw error;
        setTenants(data || []);
      } catch (error) {
        console.error("Error fetching tenants:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTenants();
  }, []);

  // Fetch config for selected tenant
  const fetchConfigForTenant = useCallback(async (tenantId: string) => {
    if (!tenantId) {
      setConfig(null);
      setInstanceId("");
      setInstanceToken("");
      setClientToken("");
      return;
    }

    try {
      const { data, error } = await supabase
        .from("whatsapp_configs")
        .select("*")
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setConfig({
          id: data.id,
          tenant_id: data.tenant_id,
          instance_id: data.instance_id || "",
          instance_token: data.instance_token || "",
          client_token: data.client_token || "",
          connection_status: data.connection_status || "disconnected",
          phone_number: data.phone_number,
          is_enabled: data.is_enabled ?? true,
          last_connected_at: data.last_connected_at,
          last_error: data.last_error,
        });
        setInstanceId(data.instance_id || "");
        setInstanceToken(data.instance_token || "");
        setClientToken(data.client_token || "");
      } else {
        setConfig(null);
        setInstanceId("");
        setInstanceToken("");
        setClientToken("");
      }
    } catch (error) {
      console.error("Error fetching WhatsApp config:", error);
    }
  }, []);

  useEffect(() => {
    if (selectedTenantId) {
      fetchConfigForTenant(selectedTenantId);
    }
  }, [selectedTenantId, fetchConfigForTenant]);

  const handleSave = async () => {
    if (!selectedTenantId || !instanceId.trim() || !instanceToken.trim() || !clientToken.trim()) {
      toast({ title: "Erro", description: "Selecione um tenant e preencha todas as credenciais (Instance ID, Instance Token e Client Token)", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        tenant_id: selectedTenantId,
        instance_id: instanceId.trim(),
        instance_token: instanceToken.trim(),
        client_token: clientToken.trim(),
        provider: "z-api",
        is_enabled: true,
        updated_at: new Date().toISOString(),
      };

      if (config?.id) {
        const { error } = await supabase
          .from("whatsapp_configs")
          .update(payload)
          .eq("id", config.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("whatsapp_configs")
          .insert({ ...payload, connection_status: "disconnected" });
        if (error) throw error;
      }

      toast({ title: "Credenciais salvas", description: "O tenant pode agora conectar o WhatsApp via QR Code." });
      await fetchConfigForTenant(selectedTenantId);
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!config?.id) return;
    if (!confirm("Remover configuração de WhatsApp deste tenant?")) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("whatsapp_configs")
        .delete()
        .eq("id", config.id);

      if (error) throw error;

      toast({ title: "Removido", description: "Configuração de WhatsApp removida" });
      setConfig(null);
      setInstanceId("");
      setInstanceToken("");
      setClientToken("");
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  const hasCredentials = !!(config?.instance_id && config?.instance_token && config?.client_token);
  const selectedTenant = tenants.find(t => t.id === selectedTenantId);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6 flex items-center justify-center min-h-[200px]">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2">
              WhatsApp - Configuração Operador
              <StatusBadge variant="outline" className="ml-2">Admin</StatusBadge>
            </CardTitle>
            <CardDescription>Configure credenciais Z-API por tenant</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert className="border-primary/20 bg-primary/5">
          <Shield className="h-4 w-4 text-primary" />
          <AlertDescription className="text-sm">
            <strong>Como funciona:</strong> Você cadastra as credenciais Z-API aqui. 
            O cliente conecta o WhatsApp dele escaneando o QR Code na tela de Integrações.
          </AlertDescription>
        </Alert>

        {/* Tenant selector */}
        <div className="space-y-2">
          <Label>Selecionar Tenant</Label>
          <Select value={selectedTenantId} onValueChange={setSelectedTenantId}>
            <SelectTrigger>
              <SelectValue placeholder="Escolha um tenant..." />
            </SelectTrigger>
            <SelectContent>
              {tenants.map((tenant) => (
                <SelectItem key={tenant.id} value={tenant.id}>
                  {tenant.name} ({tenant.slug})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedTenantId && (
          <>
            {/* Status Cards - separando credenciais de sessão */}
            <div className="grid gap-4 md:grid-cols-2">
              {/* Status de Credenciais (Z-API) */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Settings className="h-4 w-4" />
                  Credenciais Z-API
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status:</span>
                  {hasCredentials ? (
                    <StatusBadge variant="success">
                      <CheckCircle className="h-3 w-3 mr-1" />Configurado
                    </StatusBadge>
                  ) : (
                    <StatusBadge variant="outline">
                      <XCircle className="h-3 w-3 mr-1" />Não configurado
                    </StatusBadge>
                  )}
                </div>
              </div>

              {/* Status de Sessão (WhatsApp do tenant) */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Wifi className="h-4 w-4" />
                  Sessão WhatsApp (Tenant)
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status:</span>
                  {config?.connection_status === "connected" ? (
                    <StatusBadge variant="success">
                      <CheckCircle className="h-3 w-3 mr-1" />Conectado
                    </StatusBadge>
                  ) : (
                    <StatusBadge variant="outline">
                      <XCircle className="h-3 w-3 mr-1" />
                      {config?.connection_status === "qr_pending" ? "Aguardando QR" : "Desconectado"}
                    </StatusBadge>
                  )}
                </div>
                {config?.phone_number && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Número:</span>
                    <span className="text-sm font-medium flex items-center gap-1">
                      <Smartphone className="h-3 w-3" />
                      {config.phone_number}
                    </span>
                  </div>
                )}
                {config?.last_error && (
                  <div className="text-xs text-destructive mt-1">
                    Erro: {config.last_error}
                  </div>
                )}
              </div>
            </div>

            {/* Credentials form */}
            <div className="space-y-4 border-t pt-4">
              <div className="text-sm font-medium">Credenciais Z-API</div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="op_instance_id">Instance ID</Label>
                  <Input
                    id="op_instance_id"
                    placeholder="Ex: 3CEC7A5C2A10..."
                    value={instanceId}
                    onChange={(e) => setInstanceId(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="op_instance_token">Instance Token</Label>
                  <Input
                    id="op_instance_token"
                    type="password"
                    placeholder="Token da instância"
                    value={instanceToken}
                    onChange={(e) => setInstanceToken(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="op_client_token">Client Token</Label>
                  <Input
                    id="op_client_token"
                    type="password"
                    placeholder="Token da conta Z-API"
                    value={clientToken}
                    onChange={(e) => setClientToken(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Encontre em: Z-API → Segurança → Client Token
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button 
                onClick={handleSave} 
                disabled={isSaving || !instanceId.trim() || !instanceToken.trim() || !clientToken.trim()}
              >
                {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Salvar credenciais
              </Button>

              {config?.id && (
                <Button 
                  variant="ghost" 
                  className="text-destructive hover:text-destructive"
                  onClick={handleDelete} 
                  disabled={isDeleting}
                >
                  {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                  Remover
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
