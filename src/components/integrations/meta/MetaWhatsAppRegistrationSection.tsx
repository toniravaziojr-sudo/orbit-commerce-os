import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Send,
  Phone,
  Zap,
  MessageCircle,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { showErrorToast } from "@/lib/error-toast";
import { sanitizeError } from "@/lib/error-sanitizer";
import { WhatsAppDiagnosticCard } from "./WhatsAppDiagnosticCard";

export function MetaWhatsAppRegistrationSection() {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;
  const queryClient = useQueryClient();

  const [testPhone, setTestPhone] = useState("");
  const [registerPin, setRegisterPin] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [registrationStep, setRegistrationStep] = useState<"idle" | "code_sent" | "code_verified">("idle");

  const { data: whatsappConfig } = useQuery({
    queryKey: ["whatsapp-meta-config", tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      const { data, error } = await supabase
        .from("whatsapp_configs")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("provider", "meta")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  // Test message
  const testMutation = useMutation({
    mutationFn: async () => {
      if (!testPhone.trim()) throw new Error("Informe um número de telefone");
      const { data, error } = await supabase.functions.invoke("meta-whatsapp-send", {
        body: { tenant_id: tenantId, phone: testPhone, message: "Mensagem de teste via WhatsApp Oficial!" },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      return data;
    },
    onSuccess: () => { toast.success("Mensagem de teste enviada!"); setTestPhone(""); },
    onError: (err) => showErrorToast(err, { module: 'integrações', action: 'enviar' }),
  });

  // Request code
  const requestCodeMutation = useMutation({
    mutationFn: async (codeMethod: "SMS" | "VOICE") => {
      const { data, error } = await supabase.functions.invoke("meta-whatsapp-request-code", {
        body: { tenant_id: tenantId, code_method: codeMethod },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast.success(data.message || "Código enviado!");
      if (data.already_verified) setRegistrationStep("code_verified");
      else setRegistrationStep("code_sent");
      queryClient.invalidateQueries({ queryKey: ["whatsapp-meta-config", tenantId] });
    },
    onError: (err) => showErrorToast(err, { module: 'integrações', action: 'processar' }),
  });

  // Verify code
  const verifyCodeMutation = useMutation({
    mutationFn: async (code: string) => {
      const { data, error } = await supabase.functions.invoke("meta-whatsapp-verify-code", {
        body: { tenant_id: tenantId, code },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast.success(data.message || "Código verificado!");
      setVerificationCode("");
      setRegistrationStep("code_verified");
      queryClient.invalidateQueries({ queryKey: ["whatsapp-meta-config", tenantId] });
    },
    onError: (err) => showErrorToast(err, { module: 'integrações', action: 'verificar' }),
  });

  // Register phone
  const registerPhoneMutation = useMutation({
    mutationFn: async (pin: string) => {
      if (!pin || pin.length !== 6) throw new Error("PIN de 6 dígitos é obrigatório");
      const { data, error } = await supabase.functions.invoke("meta-whatsapp-register-phone", {
        body: { tenant_id: tenantId, pin },
      });
      if (error) throw error;
      if (data?.meta_diagnostic) console.log("[register-phone] Meta diagnostic:", JSON.stringify(data.meta_diagnostic, null, 2));
      if (!data.success) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success("Número registrado com sucesso!");
      setRegisterPin("");
      setRegistrationStep("idle");
      queryClient.invalidateQueries({ queryKey: ["whatsapp-meta-config", tenantId] });
    },
    onError: (err) => showErrorToast(err, { module: 'integrações', action: 'registrar' }),
  });

  if (!whatsappConfig?.phone_number || whatsappConfig.provider !== "meta") {
    return (
      <div className="py-2">
        <p className="text-xs text-muted-foreground">
          Nenhum número WhatsApp configurado. O número será detectado automaticamente ao conectar sua conta Meta com permissões de WhatsApp.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Diagnóstico inteligente — detecta e repara problemas automaticamente */}
      <WhatsAppDiagnosticCard />

      {/* Phone number status */}
      <div className="flex items-center gap-2">
        <MessageCircle className="h-4 w-4 text-green-600" />
        <span className="text-sm font-medium">+{whatsappConfig.display_phone_number || whatsappConfig.phone_number}</span>
        {whatsappConfig.connection_status === "connected" ? (
          <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800">
            <Phone className="h-3 w-3 mr-1" />Ativo
          </Badge>
        ) : whatsappConfig.connection_status === "token_invalid" ? (
          <Badge variant="outline" className="text-xs border-destructive text-destructive">
            <AlertTriangle className="h-3 w-3 mr-1" />Reconexão necessária
          </Badge>
        ) : whatsappConfig.connection_status === "awaiting_verification" ? (
          <Badge variant="outline" className="text-xs border-amber-400 text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-3 w-3 mr-1" />Aguardando código
          </Badge>
        ) : whatsappConfig.connection_status === "pending_registration" && registrationStep === "idle" ? (
          <Badge variant="outline" className="text-xs border-blue-400 text-blue-700 dark:text-blue-400">
            <Loader2 className="h-3 w-3 mr-1" />Em Análise
          </Badge>
        ) : (
          <Badge variant="outline" className="text-xs border-amber-400 text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-3 w-3 mr-1" />Registro Pendente
          </Badge>
        )}
      </div>

      {/* Token invalid — bloqueio claro com CTA de reconexão */}
      {whatsappConfig.connection_status === "token_invalid" && (
        <div className="rounded-md bg-destructive/10 border border-destructive/30 p-2.5 space-y-2">
          <p className="text-xs text-destructive font-medium">
            Sua sessão Meta expirou ou foi revogada.
          </p>
          <p className="text-xs text-muted-foreground">
            Isso geralmente acontece após troca de senha ou logout do Facebook. Enquanto não reconectar, o número não sai do status "Pendente" na Meta.
          </p>
          <p className="text-xs text-muted-foreground">
            Vá em <strong>Integrações → Meta</strong> e clique em <strong>Reconectar</strong>.
          </p>
        </div>
      )}

      {/* Registration flow */}
      {whatsappConfig.connection_status !== "connected" && (
        <div className="space-y-3">
          {whatsappConfig.connection_status === "pending_registration" && registrationStep === "idle" && (
            <div className="rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-2.5">
              <p className="text-xs text-blue-700 dark:text-blue-400">
                ✅ Seu número está em análise pela Meta. Esse processo é automático e pode levar até 48h.
              </p>
              <Button size="sm" variant="ghost" className="mt-2 text-xs h-7 text-muted-foreground" onClick={() => setRegistrationStep("code_sent")}>
                <RefreshCw className="h-3 w-3 mr-1" />Tentar novamente manualmente
              </Button>
            </div>
          )}

          {!(whatsappConfig.connection_status === "pending_registration" && registrationStep === "idle") && (
            <>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5" />Ação necessária — Ative seu número
              </div>

              {registrationStep === "idle" && whatsappConfig.connection_status !== "awaiting_verification" && (
                <div className="space-y-2 rounded-md bg-muted/50 p-2.5">
                  <p className="text-xs font-medium">Passo 1: Solicitar código de verificação</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1 text-xs h-8" onClick={() => requestCodeMutation.mutate("SMS")} disabled={requestCodeMutation.isPending}>
                      {requestCodeMutation.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Send className="h-3 w-3 mr-1" />}
                      Enviar por SMS
                    </Button>
                    <Button size="sm" variant="ghost" className="text-xs h-8" onClick={() => requestCodeMutation.mutate("VOICE")} disabled={requestCodeMutation.isPending}>
                      <Phone className="h-3 w-3 mr-1" />Voz
                    </Button>
                  </div>
                </div>
              )}

              {(registrationStep === "code_sent" || whatsappConfig.connection_status === "awaiting_verification") && (
                <div className="space-y-2 rounded-md bg-muted/50 p-2.5">
                  <p className="text-xs font-medium">Passo 2: Inserir código recebido</p>
                  <Input placeholder="Código de 6 dígitos" value={verificationCode} onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))} maxLength={6} className="text-xs h-8" />
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1 text-xs h-8" onClick={() => verifyCodeMutation.mutate(verificationCode)} disabled={verifyCodeMutation.isPending || verificationCode.length !== 6}>
                      {verifyCodeMutation.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <CheckCircle className="h-3 w-3 mr-1" />}
                      Verificar código
                    </Button>
                    <Button size="sm" variant="ghost" className="text-xs h-8" onClick={() => requestCodeMutation.mutate("SMS")} disabled={requestCodeMutation.isPending}>
                      <RefreshCw className="h-3 w-3 mr-1" />Reenviar
                    </Button>
                  </div>
                </div>
              )}

              {registrationStep === "code_verified" && (
                <div className="space-y-2 rounded-md bg-muted/50 p-2.5">
                  <p className="text-xs font-medium">Passo 3: Definir PIN de segurança</p>
                  <p className="text-xs text-muted-foreground">Use o PIN existente ou crie um novo de 6 dígitos.</p>
                  <Input placeholder="PIN de 6 dígitos" value={registerPin} onChange={(e) => setRegisterPin(e.target.value.replace(/\D/g, "").slice(0, 6))} maxLength={6} type="password" className="text-xs h-8" />
                  <Button size="sm" variant="outline" className="w-full text-xs h-8" onClick={() => registerPhoneMutation.mutate(registerPin)} disabled={registerPhoneMutation.isPending || registerPin.length !== 6}>
                    {registerPhoneMutation.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Zap className="h-3 w-3 mr-1" />}
                    Finalizar registro
                  </Button>
                </div>
              )}

              {whatsappConfig.last_error && (
                <p className="text-xs text-destructive">{sanitizeError(new Error(whatsappConfig.last_error)).userMessage}</p>
              )}
            </>
          )}
        </div>
      )}

      {/* Re-register option */}
      {whatsappConfig.connection_status === "connected" && (
        <>
          <Button size="sm" variant="ghost" className="text-xs text-muted-foreground" onClick={() => setRegistrationStep("idle")}>
            <RefreshCw className="h-3 w-3 mr-1" />Re-registrar número
          </Button>
          
          {/* Test message */}
          <div className="space-y-2 pt-2 border-t border-border/50">
            <p className="text-xs font-medium">Enviar mensagem de teste</p>
            <div className="flex gap-2">
              <Input placeholder="Número (ex: 5511999999999)" value={testPhone} onChange={(e) => setTestPhone(e.target.value)} className="text-xs h-8 flex-1" />
              <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => testMutation.mutate()} disabled={testMutation.isPending || !testPhone.trim()}>
                {testMutation.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Send className="h-3 w-3 mr-1" />}
                Testar
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
