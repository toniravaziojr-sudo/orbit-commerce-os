import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Mail, CheckCircle, XCircle, Loader2, Send, RefreshCw } from "lucide-react";

interface EmailConfig {
  id?: string;
  provider_type: string;
  from_name: string;
  from_email: string;
  reply_to: string;
  is_verified: boolean;
  last_test_at: string | null;
  last_test_result: { success: boolean; message: string } | null;
}

export function EmailProviderSettings() {
  const { currentTenant, profile } = useAuth();
  const { toast } = useToast();
  const tenantId = currentTenant?.id || profile?.current_tenant_id;
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [config, setConfig] = useState<EmailConfig>({
    provider_type: "resend",
    from_name: "",
    from_email: "",
    reply_to: "",
    is_verified: false,
    last_test_at: null,
    last_test_result: null,
  });

  useEffect(() => {
    if (tenantId) {
      fetchConfig();
    }
  }, [tenantId]);

  const fetchConfig = async () => {
    if (!tenantId) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("email_provider_configs")
        .select("*")
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setConfig({
          id: data.id,
          provider_type: data.provider_type || "resend",
          from_name: data.from_name || "",
          from_email: data.from_email || "",
          reply_to: data.reply_to || "",
          is_verified: data.is_verified || false,
          last_test_at: data.last_test_at,
          last_test_result: data.last_test_result as EmailConfig["last_test_result"],
        });
      }
    } catch (error) {
      console.error("Error fetching email config:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!tenantId) return;
    if (!config.from_email || !config.from_name) {
      toast({
        title: "Erro",
        description: "Preencha o nome e email do remetente",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        tenant_id: tenantId,
        provider_type: config.provider_type,
        from_name: config.from_name,
        from_email: config.from_email,
        reply_to: config.reply_to || null,
      };

      let error;
      if (config.id) {
        ({ error } = await supabase
          .from("email_provider_configs")
          .update(payload)
          .eq("id", config.id));
      } else {
        const { data, error: insertError } = await supabase
          .from("email_provider_configs")
          .insert(payload)
          .select("id")
          .single();
        
        error = insertError;
        if (data) {
          setConfig(prev => ({ ...prev, id: data.id }));
        }
      }

      if (error) throw error;

      toast({
        title: "Configuração salva",
        description: "As configurações de email foram salvas com sucesso",
      });
    } catch (error: any) {
      console.error("Error saving email config:", error);
      toast({
        title: "Erro ao salvar",
        description: error.message || "Não foi possível salvar as configurações",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    if (!tenantId || !config.from_email || !config.from_name) {
      toast({
        title: "Erro",
        description: "Salve as configurações antes de testar",
        variant: "destructive",
      });
      return;
    }

    setIsTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-test-email", {
        body: {
          tenant_id: tenantId,
          to_email: profile?.email,
        },
      });

      if (error) throw error;

      const testResult = {
        success: data?.success || false,
        message: data?.message || (data?.success ? "Email enviado com sucesso!" : "Falha no envio"),
      };

      // Update config with test result
      await supabase
        .from("email_provider_configs")
        .update({
          last_test_at: new Date().toISOString(),
          last_test_result: testResult,
          is_verified: testResult.success,
        })
        .eq("tenant_id", tenantId);

      setConfig(prev => ({
        ...prev,
        last_test_at: new Date().toISOString(),
        last_test_result: testResult,
        is_verified: testResult.success,
      }));

      toast({
        title: testResult.success ? "Teste bem-sucedido!" : "Falha no teste",
        description: testResult.message,
        variant: testResult.success ? "default" : "destructive",
      });
    } catch (error: any) {
      console.error("Error testing email:", error);
      
      const testResult = {
        success: false,
        message: error.message || "Erro ao enviar email de teste",
      };

      // Save failed test result
      if (config.id) {
        await supabase
          .from("email_provider_configs")
          .update({
            last_test_at: new Date().toISOString(),
            last_test_result: testResult,
            is_verified: false,
          })
          .eq("id", config.id);
      }

      setConfig(prev => ({
        ...prev,
        last_test_at: new Date().toISOString(),
        last_test_result: testResult,
        is_verified: false,
      }));

      toast({
        title: "Erro no teste",
        description: testResult.message,
        variant: "destructive",
      });
    } finally {
      setIsTesting(false);
    }
  };

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
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
            <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2">
              Email Transacional
              {config.is_verified ? (
                <StatusBadge variant="success" className="ml-2">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Verificado
                </StatusBadge>
              ) : config.id ? (
                <StatusBadge variant="warning" className="ml-2">
                  <XCircle className="h-3 w-3 mr-1" />
                  Não verificado
                </StatusBadge>
              ) : null}
            </CardTitle>
            <CardDescription>
              Configure o envio de emails para notificações e comunicações
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="from_name">Nome do remetente *</Label>
            <Input
              id="from_name"
              placeholder="Minha Loja"
              value={config.from_name}
              onChange={(e) => setConfig(prev => ({ ...prev, from_name: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="from_email">Email do remetente *</Label>
            <Input
              id="from_email"
              type="email"
              placeholder="contato@minhaloja.com.br"
              value={config.from_email}
              onChange={(e) => setConfig(prev => ({ ...prev, from_email: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">
              Use um domínio verificado no Resend para melhor entregabilidade
            </p>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="reply_to">Responder para (opcional)</Label>
            <Input
              id="reply_to"
              type="email"
              placeholder="suporte@minhaloja.com.br"
              value={config.reply_to}
              onChange={(e) => setConfig(prev => ({ ...prev, reply_to: e.target.value }))}
            />
          </div>
        </div>

        {config.last_test_at && (
          <div className={`p-4 rounded-lg border ${config.last_test_result?.success ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800' : 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800'}`}>
            <div className="flex items-start gap-3">
              {config.last_test_result?.success ? (
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
              )}
              <div>
                <p className={`font-medium ${config.last_test_result?.success ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                  {config.last_test_result?.success ? "Último teste: Sucesso" : "Último teste: Falhou"}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {config.last_test_result?.message}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(config.last_test_at).toLocaleString("pt-BR")}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : null}
            Salvar configurações
          </Button>
          <Button
            variant="outline"
            onClick={handleTest}
            disabled={isTesting || !config.id}
          >
            {isTesting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Enviar email de teste
          </Button>
        </div>

        <div className="border-t pt-4">
          <p className="text-sm text-muted-foreground">
            <strong>Nota:</strong> O sistema utiliza Resend para envio de emails. 
            Para melhor entregabilidade, configure um domínio próprio em{" "}
            <a 
              href="https://resend.com/domains" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              resend.com/domains
            </a>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
