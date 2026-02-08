// =============================================
// MELI OAUTH CALLBACK - Proxy page for Mercado Livre OAuth
// Captures code/state from ML redirect and forwards to edge function
// =============================================

import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react';

/**
 * Flow:
 * 1. ML redirects to /integrations/meli/callback?code=...&state=...
 * 2. This page captures the params
 * 3. Redirects to the edge function which processes the OAuth exchange
 * 4. Edge function redirects back to /marketplaces with success/error
 */
export default function MeliOAuthCallback() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'processing' | 'error'>('processing');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // If ML returned an error, redirect to marketplaces with error
    if (error) {
      window.location.href = `/marketplaces?meli_error=${encodeURIComponent(error)}`;
      return;
    }

    if (!code || !state) {
      setStatus('error');
      setErrorMsg('Parâmetros de autorização ausentes. Tente conectar novamente.');
      setTimeout(() => {
        window.location.href = '/marketplaces?meli_error=missing_params';
      }, 2000);
      return;
    }

    // Redirect to edge function with the same query params
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const edgeFunctionUrl = `${supabaseUrl}/functions/v1/meli-oauth-callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`;
    
    console.log('[MeliOAuthCallback] Redirecionando para edge function...');
    window.location.href = edgeFunctionUrl;
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4 max-w-md px-4">
        {status === 'processing' && (
          <>
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
            <h2 className="text-xl font-semibold">Conectando ao Mercado Livre...</h2>
            <p className="text-muted-foreground text-sm">
              Processando autorização. Você será redirecionado em instantes.
            </p>
          </>
        )}
        {status === 'error' && (
          <>
            <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
            <h2 className="text-xl font-semibold">Erro na conexão</h2>
            <p className="text-muted-foreground text-sm">{errorMsg}</p>
          </>
        )}
      </div>
    </div>
  );
}
