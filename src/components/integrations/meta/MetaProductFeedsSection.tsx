import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Facebook, Chrome, Copy, Rss } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export function MetaProductFeedsSection() {
  const { currentTenant } = useAuth();

  const getFeedUrl = (format: 'google' | 'meta') => {
    if (!currentTenant?.slug) return '';
    const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/marketing-feed`;
    return `${baseUrl}?tenant=${currentTenant.slug}&format=${format}`;
  };

  const copyUrl = (format: 'google' | 'meta') => {
    navigator.clipboard.writeText(getFeedUrl(format));
    toast.success('URL copiada!');
  };

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium flex items-center gap-2">
        <Rss className="h-4 w-4" />
        Catálogos de Produtos
      </h4>
      
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Facebook className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium">Meta Catalog (CSV)</span>
          </div>
          <div className="flex gap-1.5">
            <Input value={getFeedUrl('meta')} readOnly className="font-mono text-xs h-8" />
            <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => copyUrl('meta')}>
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <div className="rounded-lg border p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Chrome className="h-4 w-4 text-yellow-500" />
            <span className="text-sm font-medium">Google Merchant (XML)</span>
          </div>
          <div className="flex gap-1.5">
            <Input value={getFeedUrl('google')} readOnly className="font-mono text-xs h-8" />
            <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => copyUrl('google')}>
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Feeds atualizados automaticamente. Use essas URLs nas plataformas de anúncios.
      </p>
    </div>
  );
}
