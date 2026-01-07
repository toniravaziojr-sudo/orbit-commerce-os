import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Callback page for Late OAuth flow
 * This page is opened in a popup and handles:
 * 1. Receiving the callback from Late
 * 2. Calling the backend to finalize the connection
 * 3. Communicating with the parent window via postMessage
 * 4. Closing itself automatically
 */
export default function LateCallback() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
  const [message, setMessage] = useState("Processando conexão...");
  const [platform, setPlatform] = useState<string | null>(null);

  useEffect(() => {
    const processCallback = async () => {
      const state = searchParams.get("state");
      const connected = searchParams.get("connected");
      const error = searchParams.get("error");
      const lateError = searchParams.get("late_error");
      const lateConnected = searchParams.get("late_connected");

      // Handle direct success/error from edge function redirect
      if (lateConnected === "true") {
        setStatus("success");
        setMessage("Conexão realizada com sucesso!");
        notifyParentAndClose("success", connected || "facebook");
        return;
      }

      if (lateError) {
        setStatus("error");
        setMessage(decodeURIComponent(lateError));
        notifyParentAndClose("error", connected || "facebook", lateError);
        return;
      }

      // Handle error from Late
      if (error) {
        setStatus("error");
        setMessage(decodeURIComponent(error));
        notifyParentAndClose("error", connected || "facebook", error);
        return;
      }

      // If we have state, call the callback edge function
      if (state) {
        try {
          setMessage("Finalizando conexão...");
          
          // Build callback URL with all params
          const callbackUrl = new URL(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/late-auth-callback`
          );
          callbackUrl.searchParams.set("state", state);
          if (connected) callbackUrl.searchParams.set("connected", connected);
          
          const response = await fetch(callbackUrl.toString());
          
          // The edge function returns a redirect, so we follow it
          if (response.redirected) {
            // Parse the redirect URL for success/error
            const redirectUrl = new URL(response.url);
            const redirectError = redirectUrl.searchParams.get("late_error");
            const redirectSuccess = redirectUrl.searchParams.get("late_connected");
            
            if (redirectSuccess === "true") {
              setStatus("success");
              setMessage("Conexão realizada com sucesso!");
              notifyParentAndClose("success", connected || "facebook");
            } else if (redirectError) {
              setStatus("error");
              setMessage(decodeURIComponent(redirectError));
              notifyParentAndClose("error", connected || "facebook", redirectError);
            } else {
              // Redirect happened but no clear result - assume success
              setStatus("success");
              setMessage("Conexão processada!");
              notifyParentAndClose("success", connected || "facebook");
            }
          } else {
            // No redirect - check response
            const data = await response.json().catch(() => ({}));
            if (data.success) {
              setStatus("success");
              setMessage("Conexão realizada!");
              notifyParentAndClose("success", connected || "facebook");
            } else {
              setStatus("error");
              setMessage(data.error || "Erro desconhecido");
              notifyParentAndClose("error", connected || "facebook", data.error);
            }
          }
        } catch (err) {
          console.error("Callback error:", err);
          setStatus("error");
          setMessage("Erro ao processar conexão");
          notifyParentAndClose("error", connected || "facebook", "Erro ao processar");
        }
      } else {
        // No state - invalid callback
        setStatus("error");
        setMessage("Parâmetros de callback inválidos");
        notifyParentAndClose("error", null, "Invalid callback");
      }
    };

    processCallback();
  }, [searchParams]);

  const notifyParentAndClose = (
    resultStatus: "success" | "error",
    platformValue: string | null,
    errorMessage?: string
  ) => {
    setPlatform(platformValue);

    // Try to communicate with parent window
    if (window.opener && !window.opener.closed) {
      try {
        const origin = window.opener.location.origin;
        window.opener.postMessage(
          {
            type: "late:connected",
            success: resultStatus === "success",
            platform: platformValue,
            error: errorMessage,
          },
          origin
        );
      } catch (e) {
        // Cross-origin - try with "*" (less secure but necessary)
        window.opener.postMessage(
          {
            type: "late:connected",
            success: resultStatus === "success",
            platform: platformValue,
            error: errorMessage,
          },
          "*"
        );
      }

      // Close popup after a short delay to show result
      setTimeout(() => {
        window.close();
      }, 1500);
    } else {
      // No opener - redirect to integrations page after delay
      setTimeout(() => {
        const baseUrl = window.location.origin;
        const redirectUrl = resultStatus === "success"
          ? `${baseUrl}/integrations?late_connected=true&platform=${platformValue || ''}`
          : `${baseUrl}/integrations?late_error=${encodeURIComponent(errorMessage || 'Erro')}`;
        window.location.href = redirectUrl;
      }, 2000);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 to-purple-700">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl p-8 max-w-md mx-4 text-center">
        {status === "processing" && (
          <>
            <Loader2 className="h-16 w-16 animate-spin text-blue-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Processando
            </h2>
            <p className="text-gray-600 dark:text-gray-400">{message}</p>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Conectado!
            </h2>
            <p className="text-gray-600 dark:text-gray-400">{message}</p>
            <p className="text-sm text-gray-500 mt-4">
              Esta janela fechará automaticamente...
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Erro na Conexão
            </h2>
            <p className="text-gray-600 dark:text-gray-400">{message}</p>
            <p className="text-sm text-gray-500 mt-4">
              Esta janela fechará automaticamente...
            </p>
          </>
        )}
      </div>
    </div>
  );
}
