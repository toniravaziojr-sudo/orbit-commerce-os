/**
 * PrintViewer — visualizador interno de impressão.
 *
 * Por quê: links diretos para domínios de parceiros (api.focusnfe.com.br, etc.)
 * são bloqueados por extensões e proxies corporativos com ERR_BLOCKED_BY_CLIENT.
 * Esta página busca o PDF pelo backend do próprio sistema, exibe num iframe e
 * dispara o diálogo de impressão automaticamente. Sem domínio externo no
 * navegador → sem bloqueio.
 *
 * Fontes suportadas (?source=):
 *   - danfe       → invoke fiscal-download-docs (single)
 *   - etiqueta    → invoke shipping-get-label (signed URL do bucket interno → fetch → blob)
 *
 * Botões já existentes apenas trocam o destino do clique para esta rota.
 * Marcação "Impressa" continua sendo feita pelo chamador (regra anti-regressão
 * de fiscal-nf-status-and-print-uniqueness preservada).
 */
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2, AlertTriangle, Download, Printer } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';

type Source = 'danfe' | 'etiqueta';

export default function PrintViewer() {
  const [params] = useSearchParams();
  const source = (params.get('source') || '') as Source;
  const id = params.get('id') || '';
  const autoPrintParam = params.get('autoprint');
  const autoPrint = autoPrintParam === null ? true : autoPrintParam !== '0';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [filename, setFilename] = useState<string>('documento.pdf');
  const printedRef = useRef(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    let createdUrl: string | null = null;

    (async () => {
      try {
        if (!source || !id) {
          throw new Error('Documento não informado.');
        }

        let pdfBlob: Blob | null = null;
        let suggestedName = 'documento.pdf';

        if (source === 'danfe') {
          // Chama o proxy fiscal existente — devolve o PDF da DANFE (single) com
          // Content-Disposition: attachment, mas como Blob aqui dentro tanto faz.
          const { data, error } = await supabase.functions.invoke('fiscal-download-docs', {
            body: { invoice_ids: [id], format: 'danfe' },
          });
          if (error) throw error;
          if (data instanceof Blob) {
            pdfBlob = data;
          } else if (data && typeof data === 'object' && (data as any).success === false) {
            throw new Error((data as any).error || 'Não foi possível obter a DANFE.');
          } else {
            throw new Error('Resposta inválida do servidor fiscal.');
          }
          suggestedName = `DANFE-${id.slice(0, 8)}.pdf`;
        } else if (source === 'etiqueta') {
          const { data, error } = await supabase.functions.invoke('shipping-get-label', {
            body: { shipment_id: id },
          });
          if (error) throw error;
          if (!data?.success) throw new Error(data?.error || 'Não foi possível obter a etiqueta.');

          if (data.label_url) {
            // Bucket interno: signed URL do Supabase Storage. Buscamos via fetch
            // para servir o PDF como blob na mesma origem do iframe (evita
            // qualquer bloqueio de extensão sobre PDFs em domínios externos).
            const res = await fetch(data.label_url);
            if (!res.ok) throw new Error('Falha ao baixar o PDF da etiqueta.');
            pdfBlob = await res.blob();
          } else if (data.label_base64) {
            const bin = atob(data.label_base64);
            const bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
            pdfBlob = new Blob([bytes], { type: data.label_type || 'application/pdf' });
          } else {
            throw new Error('Etiqueta não disponível.');
          }
          suggestedName = `Etiqueta-${id.slice(0, 8)}.pdf`;
        } else {
          throw new Error('Tipo de documento não suportado.');
        }

        if (!pdfBlob) throw new Error('PDF vazio.');
        if (cancelled) return;

        createdUrl = URL.createObjectURL(
          pdfBlob.type ? pdfBlob : new Blob([pdfBlob], { type: 'application/pdf' }),
        );
        setBlobUrl(createdUrl);
        setFilename(suggestedName);
        setLoading(false);
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || 'Erro ao carregar o documento.');
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [source, id]);

  // Dispara o diálogo de impressão quando o PDF terminar de carregar no iframe.
  const handleIframeLoad = () => {
    if (!autoPrint || printedRef.current || !iframeRef.current) return;
    printedRef.current = true;
    try {
      const win = iframeRef.current.contentWindow;
      // Pequeno delay garante que viewers de PDF embutidos estejam prontos.
      setTimeout(() => {
        try {
          win?.focus();
          win?.print();
        } catch {
          /* navegador bloqueou — fallback é o botão de download */
        }
      }, 300);
    } catch {
      /* ignore */
    }
  };

  const handleManualPrint = () => {
    try {
      iframeRef.current?.contentWindow?.focus();
      iframeRef.current?.contentWindow?.print();
    } catch {
      /* ignore */
    }
  };

  const handleDownload = () => {
    if (!blobUrl) return;
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 bg-background flex flex-col">
      <div className="border-b px-4 py-2 flex items-center justify-between gap-2">
        <div className="text-sm font-medium truncate">
          {source === 'danfe' && 'Imprimir DANFE'}
          {source === 'etiqueta' && 'Imprimir Etiqueta'}
          {!source && 'Imprimir'}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleDownload} disabled={!blobUrl}>
            <Download className="h-4 w-4 mr-2" />
            Baixar PDF
          </Button>
          <Button size="sm" onClick={handleManualPrint} disabled={!blobUrl}>
            <Printer className="h-4 w-4 mr-2" />
            Imprimir
          </Button>
        </div>
      </div>

      <div className="flex-1 relative bg-muted">
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-sm">Preparando documento para impressão…</p>
          </div>
        )}

        {error && !loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-6">
            <AlertTriangle className="h-10 w-10 text-destructive" />
            <p className="text-sm font-medium">Não foi possível carregar o documento.</p>
            <p className="text-xs text-muted-foreground max-w-md">{error}</p>
            <Button size="sm" variant="outline" onClick={() => window.close()}>
              Fechar
            </Button>
          </div>
        )}

        {blobUrl && !error && (
          <iframe
            ref={iframeRef}
            src={blobUrl}
            title="Documento para impressão"
            className="w-full h-full border-0"
            onLoad={handleIframeLoad}
          />
        )}
      </div>
    </div>
  );
}
