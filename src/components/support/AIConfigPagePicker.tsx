import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, FileText, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { useStorePages } from "@/hooks/useStorePages";

interface Props {
  faqIds: string[];
  policyIds: string[];
  onChangeFaq: (ids: string[]) => void;
  onChangePolicy: (ids: string[]) => void;
}

/**
 * Permite ao lojista marcar quais páginas da loja serão usadas como
 * FAQ e Políticas pela IA. Sem essa marcação, a IA não tem fonte oficial.
 */
export function AIConfigPagePicker({ faqIds, policyIds, onChangeFaq, onChangePolicy }: Props) {
  const { pages, isLoading } = useStorePages();
  const published = (pages || []).filter((p) => p.is_published);

  const toggle = (list: string[], id: string, setter: (ids: string[]) => void) => {
    setter(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  };

  const noPages = !isLoading && published.length === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Páginas oficiais da loja (FAQ e Políticas)
        </CardTitle>
        <CardDescription>
          Marque quais páginas publicadas da sua loja a IA deve usar como fonte
          oficial de FAQ e de Políticas (frete, troca, privacidade, etc.).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {noPages && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between gap-3">
              <span>
                Você ainda não tem páginas publicadas. Crie e publique as páginas
                essenciais da loja antes de conectar — sem isso a IA não terá fonte oficial.
              </span>
              <Button asChild size="sm" variant="outline">
                <Link to="/pages">
                  <ExternalLink className="h-4 w-4 mr-1" /> Páginas da loja
                </Link>
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {!noPages && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Páginas usadas como FAQ</Label>
              <div className="space-y-1 rounded-md border p-2 max-h-56 overflow-auto">
                {published.map((p) => (
                  <div key={`faq-${p.id}`} className="flex items-center justify-between py-1 px-1">
                    <div className="text-sm truncate flex-1">
                      {p.title}
                      <span className="text-xs text-muted-foreground ml-1">/{p.slug}</span>
                    </div>
                    <Switch
                      checked={faqIds.includes(p.id)}
                      onCheckedChange={() => toggle(faqIds, p.id, onChangeFaq)}
                    />
                  </div>
                ))}
              </div>
              <Badge variant="secondary" className="text-[10px]">
                {faqIds.length} marcada(s)
              </Badge>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Páginas usadas como Políticas</Label>
              <div className="space-y-1 rounded-md border p-2 max-h-56 overflow-auto">
                {published.map((p) => (
                  <div key={`pol-${p.id}`} className="flex items-center justify-between py-1 px-1">
                    <div className="text-sm truncate flex-1">
                      {p.title}
                      <span className="text-xs text-muted-foreground ml-1">/{p.slug}</span>
                    </div>
                    <Switch
                      checked={policyIds.includes(p.id)}
                      onCheckedChange={() => toggle(policyIds, p.id, onChangePolicy)}
                    />
                  </div>
                ))}
              </div>
              <Badge variant="secondary" className="text-[10px]">
                {policyIds.length} marcada(s)
              </Badge>
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          A IA lê o conteúdo das páginas marcadas para responder dúvidas dos clientes.
          Mantenha-as atualizadas.
        </p>
      </CardContent>
    </Card>
  );
}
