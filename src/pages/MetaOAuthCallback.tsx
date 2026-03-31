import { useEffect, useState, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type FlowStep = "loading" | "success" | "error";

export default function MetaOAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [step, setStep] = useState<FlowStep>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const processedRef = useRef(false);

  const notifyParentAndClose = (success: boolean, error?: string) => {
    sessionStorage.removeItem('oauth_in_progress');
    const baseUrl = window.location.origin;
    const redirectUrl = success
      ? `${baseUrl}/integrations?meta_connected=true&t=${Date.now()}`
      : `${baseUrl}/integrations?meta_error=${encodeURIComponent(error || 'Erro')}&t=${Date.now()}`;

    try {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({ type: "meta:connected", success, error }, "*");
      }
    } catch (e) {}

    setTimeout(() => {
      try { if (window.opener && !window.opener.closed) window.close(); } catch {}
      setTimeout(() => { window.location.href = redirectUrl; }, 300);
    }, 1200);
  };

  useEffect(() => {
    if (processedRef.current) return;

    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");
    const successParam = searchParams.get("success");

    if (successParam === "true") {
      setStep("success");
      notifyParentAndClose(true);
      return;
    }

    if (error) {
      processedRef.current = true;
      const errMsg = getErrorMessage(error, errorDescription || "");
      setStep("error");
      setErrorMessage(errMsg);
      notifyParentAndClose(false, errMsg);
      return;
    }

    if (code && state) {
      processedRef.current = true;
      processOAuthCallback(code, state);
      return;
    }

    processedRef.current = true;
    setStep("error");
    setErrorMessage("Acesso inválido.");
    notifyParentAndClose(false, "Acesso inválido.");
  }, [searchParams]);

  async function processOAuthCallback(code: string, state: string) {
    try {
      const { data, error } = await supabase.functions.invoke("meta-oauth-callback", {
        body: { code, state },
      });

      if (error || !data?.success) {
        const errMsg = data?.error || error?.message || "Erro ao processar autorização";
        setStep("error");
        setErrorMessage(errMsg);
        notifyParentAndClose(false, errMsg);
        return;
      }

      // Callback processado com sucesso — redirecionar direto sem seleção de ativos
      // Os ativos descobertos já foram salvos em discovered_assets pelo backend
      // A seleção operacional será feita nos toggles individuais
      setStep("success");
      notifyParentAndClose(true);

    } catch (err) {
      setStep("error");
      setErrorMessage("Erro inesperado. Tente novamente.");
      notifyParentAndClose(false, "Erro inesperado.");
    }
  }

  const handleClose = () => {
    if (window.opener && !window.opener.closed) window.close();
    else navigate("/integrations", { replace: true });
  };

  // Estados: loading → success | error
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            {step === "loading" && <Loader2 className="h-12 w-12 text-primary animate-spin" />}
            {step === "success" && <CheckCircle className="h-12 w-12 text-green-500" />}
            {step === "error" && <XCircle className="h-12 w-12 text-destructive" />}
          </div>
          <CardTitle>
            {step === "loading" && "Conectando..."}
            {step === "success" && "Meta conectada!"}
            {step === "error" && "Erro na conexão"}
          </CardTitle>
          <CardDescription>
            {step === "loading" && "Finalizando a conexão com o Meta..."}
            {step === "success" && "Conexão realizada com sucesso. Ative as funcionalidades desejadas nos toggles. Fechando..."}
            {step === "error" && errorMessage}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          {step === "error" && (
            <Button onClick={handleClose} className="mt-4">
              {window.opener ? "Fechar" : "Voltar para Integrações"}
            </Button>
          )}
          {step === "success" && (
            <p className="text-sm text-muted-foreground mt-2">
              Esta janela será fechada automaticamente...
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function getErrorMessage(error: string, description: string): string {
  if (error === "access_denied") return "Acesso negado. Você cancelou a autorização.";
  if (description) return description;
  return `Erro: ${error}`;
}