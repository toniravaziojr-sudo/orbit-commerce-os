import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * ThreadsOAuthCallback
 * 
 * Componente montado na rota /integrations/threads/callback.
 * Captura code + state da URL, envia para threads-oauth-callback,
 * e comunica o resultado via postMessage para o popup pai.
 */
export function ThreadsOAuthCallback() {
  const [searchParams] = useSearchParams();
  const { session } = useAuth();
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;

    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    if (error) {
      window.opener?.postMessage(
        { type: "threads:connected", success: false, error: decodeURIComponent(error) },
        "*"
      );
      window.close();
      return;
    }

    if (!code || !state) {
      window.opener?.postMessage(
        { type: "threads:connected", success: false, error: "Parâmetros ausentes" },
        "*"
      );
      window.close();
      return;
    }

    hasProcessed.current = true;

    (async () => {
      try {
        const { data, error: fnError } = await supabase.functions.invoke("threads-oauth-callback", {
          body: { code, state },
        });

        if (fnError || !data?.success) {
          window.opener?.postMessage(
            { type: "threads:connected", success: false, error: data?.error || "Erro ao processar" },
            "*"
          );
        } else {
          window.opener?.postMessage(
            { 
              type: "threads:connected", 
              success: true, 
              username: data.connection?.username,
            },
            "*"
          );
        }
      } catch (err: any) {
        window.opener?.postMessage(
          { type: "threads:connected", success: false, error: err.message || "Erro desconhecido" },
          "*"
        );
      }

      setTimeout(() => window.close(), 1500);
    })();
  }, [searchParams, session]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center space-y-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
        <p className="text-sm text-muted-foreground">Conectando Threads...</p>
      </div>
    </div>
  );
}
