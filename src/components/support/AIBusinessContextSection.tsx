import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, Building2, MessageSquare, ShieldAlert, BookOpen } from "lucide-react";
import { useTenantBrandContext } from "@/hooks/useTenantBrandContext";

interface Props {
  businessContext: string;
  attendanceRules: string;
  customKnowledge: string;
  systemPrompt: string;
  onChange: (patch: {
    business_context?: string;
    attendance_rules?: string;
    custom_knowledge?: string;
    system_prompt?: string;
  }) => void;
}

const EXAMPLE_BUSINESS = `Nós trabalhamos com produtos de beleza masculina, especificamente para tratamento e prevenção da calvície. Os produtos de tratamento são Shampoo Calvície Zero, Balm Pós-Banho e Loção Pós-Banho. O Balm é usado durante o dia e a Loção durante a noite. O tratamento completo é o Kit Banho Calvície Zero, composto por esses três produtos.`;

const EXAMPLE_RULES = `Atender de forma cordial e objetiva. Sempre perguntar o objetivo do cliente antes de recomendar produto. Quando o cliente demonstrar interesse, oferecer o tratamento completo. Nunca prometer prazo de resultado. Se o cliente pedir desconto fora de promoção vigente, dizer que não é possível e oferecer benefícios da compra do kit completo. Se a dúvida for médica, encaminhar para especialista.`;

const Counter = ({ value }: { value: string }) => (
  <span className="text-[10px] text-muted-foreground">{value.length} caracteres</span>
);

export function AIBusinessContextSection({
  businessContext,
  attendanceRules,
  customKnowledge,
  systemPrompt,
  onChange,
}: Props) {
  const { brand, upsert } = useTenantBrandContext();
  const [showLegacy, setShowLegacy] = useState(false);
  const [bannedClaimsDraft, setBannedClaimsDraft] = useState<string | null>(null);
  const [doNotDoDraft, setDoNotDoDraft] = useState<string | null>(null);

  const banned = bannedClaimsDraft ?? (brand?.banned_claims || []).join(", ");
  const dnd = doNotDoDraft ?? (brand?.do_not_do || []).join(", ");
  const claimsDirty = bannedClaimsDraft !== null || doNotDoDraft !== null;

  const saveClaims = () => {
    upsert.mutate({
      banned_claims: (bannedClaimsDraft ?? banned).split(",").map((s) => s.trim()).filter(Boolean),
      do_not_do: (doNotDoDraft ?? dnd).split(",").map((s) => s.trim()).filter(Boolean),
    });
    setBannedClaimsDraft(null);
    setDoNotDoDraft(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Como a IA entende seu negócio</CardTitle>
        <CardDescription>
          Quanto mais clara for sua resposta em cada bloco, melhor a IA atende e vende.
          Cada bloco tem um propósito específico — não misture os assuntos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 1. Contexto do negócio */}
        <div id="bloco-contexto" className="space-y-2 scroll-mt-24">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2 text-sm font-semibold">
              <Building2 className="h-4 w-4" />
              Contexto do negócio
              <Badge variant="destructive" className="text-[10px]">Crítico</Badge>
            </Label>
            <Counter value={businessContext} />
          </div>
          <p className="text-xs text-muted-foreground">
            O que sua empresa vende, para quem, como funciona. Foque nos fatos.
          </p>
          <Textarea
            placeholder={EXAMPLE_BUSINESS}
            value={businessContext}
            onChange={(e) => onChange({ business_context: e.target.value })}
            rows={6}
          />
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer hover:text-foreground">Ver exemplo</summary>
            <pre className="mt-2 whitespace-pre-wrap p-2 rounded bg-muted/50">{EXAMPLE_BUSINESS}</pre>
          </details>
        </div>

        {/* 2. Regras gerais */}
        <div id="bloco-regras" className="space-y-2 scroll-mt-24 pt-4 border-t">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2 text-sm font-semibold">
              <MessageSquare className="h-4 w-4" />
              Regras gerais de atendimento
              <Badge className="text-[10px]">Recomendado</Badge>
            </Label>
            <Counter value={attendanceRules} />
          </div>
          <p className="text-xs text-muted-foreground">
            Como a IA deve conduzir a conversa, quando perguntar, quando escalar para humano, regras comerciais.
          </p>
          <Textarea
            placeholder={EXAMPLE_RULES}
            value={attendanceRules}
            onChange={(e) => onChange({ attendance_rules: e.target.value })}
            rows={6}
          />
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer hover:text-foreground">Ver exemplo</summary>
            <pre className="mt-2 whitespace-pre-wrap p-2 rounded bg-muted/50">{EXAMPLE_RULES}</pre>
          </details>
        </div>

        {/* 3. Claims/promessas proibidas — vai para tenant_brand_context */}
        <div id="bloco-claims" className="space-y-3 scroll-mt-24 pt-4 border-t">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2 text-sm font-semibold">
              <ShieldAlert className="h-4 w-4" />
              Claims / promessas proibidas
              <Badge variant="destructive" className="text-[10px]">Crítico</Badge>
            </Label>
            <span className="text-[10px] text-muted-foreground">Salvo no contexto de marca</span>
          </div>
          <p className="text-xs text-muted-foreground">
            O que a IA <strong>não pode prometer</strong>: resultado garantido, prazo médico, comparação direta com concorrente, etc.
          </p>

          <div className="space-y-2">
            <Label className="text-xs">Promessas proibidas (separadas por vírgula)</Label>
            <Input
              placeholder="cura garantida, resultado em 7 dias, devolução do dinheiro"
              value={banned}
              onChange={(e) => setBannedClaimsDraft(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Comportamentos a evitar (separados por vírgula)</Label>
            <Input
              placeholder="comparar com concorrente, dar conselho médico, prometer prazo de entrega exato"
              value={dnd}
              onChange={(e) => setDoNotDoDraft(e.target.value)}
            />
          </div>

          {claimsDirty && (
            <div className="flex justify-end">
              <Button size="sm" onClick={saveClaims} disabled={upsert.isPending}>
                {upsert.isPending ? "Salvando…" : "Salvar claims"}
              </Button>
            </div>
          )}
        </div>

        {/* 4. Conhecimento adicional — usa custom_knowledge legado */}
        <div id="bloco-conhecimento" className="space-y-2 scroll-mt-24 pt-4 border-t">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2 text-sm font-semibold">
              <BookOpen className="h-4 w-4" />
              Conhecimento adicional
              <Badge variant="secondary" className="text-[10px]">Informativo</Badge>
            </Label>
            <Counter value={customKnowledge} />
          </div>
          <p className="text-xs text-muted-foreground">
            Detalhes específicos da loja, exceções, informações técnicas que não cabem nos blocos acima.
          </p>
          <Textarea
            placeholder="Ex.: O Kit Banho leva 2 dias úteis a mais para envio. Promoção de aniversário começa todo dia 10. Cupom BEMVINDO10 só vale primeira compra."
            value={customKnowledge}
            onChange={(e) => onChange({ custom_knowledge: e.target.value })}
            rows={5}
          />
        </div>

        {/* Legado: system_prompt */}
        <div className="pt-4 border-t">
          <button
            type="button"
            onClick={() => setShowLegacy((v) => !v)}
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            {showLegacy ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            {showLegacy ? "Ocultar" : "Mostrar"} prompt do sistema (legado / avançado)
          </button>
          {showLegacy && (
            <div className="space-y-2 mt-3">
              <Label className="text-xs">Prompt do sistema (legado)</Label>
              <p className="text-[11px] text-muted-foreground">
                Mantido por compatibilidade. Use os 4 blocos acima para configurar a IA. Este campo continua sendo lido durante a transição.
              </p>
              <Textarea
                value={systemPrompt}
                onChange={(e) => onChange({ system_prompt: e.target.value })}
                rows={4}
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
