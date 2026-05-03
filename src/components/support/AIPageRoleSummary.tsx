import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, FileText, ExternalLink, HelpCircle, Scale } from "lucide-react";
import { Link } from "react-router-dom";
import { useStorePages } from "@/hooks/useStorePages";

/**
 * Mostra quantas páginas estão marcadas como FAQ e como Política.
 * A marcação acontece dentro de cada página (campo ai_role), não aqui.
 */
export function AIPageRoleSummary() {
  const { pages, isLoading } = useStorePages();
  const list = pages || [];
  const published = list.filter((p) => p.is_published);
  const faqPages = published.filter((p) => p.ai_role === "faq");
  const policyPages = published.filter((p) => p.ai_role === "policy");

  const noPagesAtAll = !isLoading && list.length === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Páginas oficiais da loja (FAQ e Políticas)
        </CardTitle>
        <CardDescription>
          A IA usa páginas publicadas da sua loja como fonte oficial.
          Marque cada página como <strong>FAQ</strong> ou <strong>Política</strong> dentro
          do editor da própria página.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {noPagesAtAll && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between gap-3">
              <span>
                Você ainda não tem páginas. Crie e publique as páginas essenciais
                antes — sem isso a IA não terá fonte oficial.
              </span>
              <Button asChild size="sm" variant="outline">
                <Link to="/pages">
                  <ExternalLink className="h-4 w-4 mr-1" /> Páginas da loja
                </Link>
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {!noPagesAtAll && (
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <HelpCircle className="h-4 w-4" /> FAQ
                </div>
                <Badge variant={faqPages.length > 0 ? "default" : "secondary"}>
                  {faqPages.length} página(s)
                </Badge>
              </div>
              {faqPages.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Nenhuma página marcada como FAQ ainda.
                </p>
              ) : (
                <ul className="text-xs text-muted-foreground space-y-0.5 max-h-24 overflow-auto">
                  {faqPages.map((p) => (
                    <li key={p.id} className="truncate">• {p.title}</li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-lg border p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Scale className="h-4 w-4" /> Políticas
                </div>
                <Badge variant={policyPages.length > 0 ? "default" : "secondary"}>
                  {policyPages.length} página(s)
                </Badge>
              </div>
              {policyPages.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Nenhuma página marcada como Política ainda.
                </p>
              ) : (
                <ul className="text-xs text-muted-foreground space-y-0.5 max-h-24 overflow-auto">
                  {policyPages.map((p) => (
                    <li key={p.id} className="truncate">• {p.title}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {!noPagesAtAll && (
          <div className="flex items-center justify-between gap-3 pt-1">
            <p className="text-xs text-muted-foreground">
              Para marcar uma página como FAQ ou Política, edite a página em
              Páginas da Loja e selecione o papel para a IA.
            </p>
            <Button asChild size="sm" variant="outline">
              <Link to="/pages">
                <ExternalLink className="h-4 w-4 mr-1" /> Gerenciar páginas
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
