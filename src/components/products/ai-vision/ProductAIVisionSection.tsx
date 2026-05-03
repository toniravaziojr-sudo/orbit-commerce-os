import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  useProductAIVision,
  type CommercialRole,
  type ProductKind,
  type RelationType,
} from "@/hooks/useProductAIVision";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Sparkles, AlertTriangle, X, Plus, Info } from "lucide-react";

interface Props {
  productId: string;
  hasComponents?: boolean; // kit/combo composition exists
}

const ROLE_OPTIONS: { value: CommercialRole; label: string }[] = [
  { value: "primary", label: "Produto-base / principal" },
  { value: "complement", label: "Complemento" },
  { value: "upgrade", label: "Upgrade / versão superior" },
  { value: "kit_component", label: "Componente de kit" },
  { value: "accessory", label: "Acessório" },
  { value: "consumable", label: "Consumível / refil" },
];

const KIND_OPTIONS: { value: ProductKind; label: string }[] = [
  { value: "single", label: "Produto único" },
  { value: "pack", label: "Pack de quantidade (2x, 3x, 6x...)" },
  { value: "kit", label: "Kit" },
  { value: "combo", label: "Combo" },
  { value: "bundle", label: "Bundle" },
  { value: "complement", label: "Complemento" },
  { value: "upgrade", label: "Upgrade" },
  { value: "replacement", label: "Reposição" },
];

export function ProductAIVisionSection({ productId, hasComponents }: Props) {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;
  const { payload, relations, isLoading, savePayload, addRelation, removeRelation } =
    useProductAIVision(productId, tenantId);

  const [role, setRole] = useState<CommercialRole>(payload?.commercial_role ?? "primary");
  const [kind, setKind] = useState<ProductKind>(payload?.product_kind ?? "single");
  const [baseId, setBaseId] = useState<string | null>(payload?.base_product_id ?? null);
  const [isBase, setIsBase] = useState<boolean | null>(payload?.is_base_candidate ?? null);
  const [whenRec, setWhenRec] = useState(payload?.when_to_recommend ?? "");
  const [whenNot, setWhenNot] = useState(payload?.when_not_to_indicate ?? "");
  const [notes, setNotes] = useState(payload?.recommendation_notes ?? "");

  useEffect(() => {
    if (payload) {
      setRole(payload.commercial_role);
      setKind(payload.product_kind);
      setBaseId(payload.base_product_id);
      setIsBase(payload.is_base_candidate);
      setWhenRec(payload.when_to_recommend ?? "");
      setWhenNot(payload.when_not_to_indicate ?? "");
      setNotes(payload.recommendation_notes ?? "");
    }
  }, [payload]);

  const showBasePicker = kind === "pack" || kind === "upgrade" || kind === "replacement";
  const isKit = kind === "kit" || kind === "combo" || kind === "bundle";
  const requiresBase = kind === "pack";
  const missingVision = !payload;
  const missingBase = requiresBase && !baseId;
  const missingComposition = isKit && hasComponents === false;

  const handleSave = () => {
    if (missingBase) return;
    savePayload.mutate({
      commercial_role: role,
      product_kind: kind,
      base_product_id: baseId,
      is_base_candidate: isBase,
      when_to_recommend: whenRec || null,
      when_not_to_indicate: whenNot || null,
      recommendation_notes: notes || null,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Visão da IA
          {payload?.has_manual_overrides && (
            <Badge variant="secondary" className="ml-2">Manual</Badge>
          )}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Estes campos ajudam a IA a decidir <strong>quando recomendar</strong> este produto.
          Não afetam preço, estoque ou loja — só o comportamento da IA de atendimento e vendas.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {missingVision && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Este produto ainda <strong>não tem visão da IA</strong>. Preencha abaixo para que a IA
              entenda o papel comercial dele.
            </AlertDescription>
          </Alert>
        )}

        {missingBase && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Pack de quantidade exige <strong>produto-base relacionado</strong>.
            </AlertDescription>
          </Alert>
        )}

        {missingComposition && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Kit/combo sem composição. Cadastre os componentes na aba <strong>Composição</strong>.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Papel comercial</Label>
            <Select value={role} onValueChange={(v) => setRole(v as CommercialRole)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Tipo comercial</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as ProductKind)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {KIND_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <Label>Pode aparecer como produto-base na recomendação inicial?</Label>
            <p className="text-xs text-muted-foreground mt-1">
              Packs e kits geralmente devem ficar <strong>desativado</strong>. Produtos-base puros, ativados.
              Deixe sem marcar se ainda não souber.
            </p>
          </div>
          <Select
            value={isBase === null ? "null" : isBase ? "true" : "false"}
            onValueChange={(v) => setIsBase(v === "null" ? null : v === "true")}
          >
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="null">Não classificado</SelectItem>
              <SelectItem value="true">Sim</SelectItem>
              <SelectItem value="false">Não</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {showBasePicker && (
          <BaseProductPicker
            tenantId={tenantId}
            currentProductId={productId}
            value={baseId}
            onChange={setBaseId}
          />
        )}

        <div className="space-y-2">
          <Label>Quando recomendar</Label>
          <Textarea
            value={whenRec}
            onChange={(e) => setWhenRec(e.target.value.slice(0, 600))}
            placeholder="Ex: cliente busca rotina noturna, pele oleosa, primeira compra..."
            rows={3}
          />
          <p className="text-xs text-muted-foreground">{whenRec.length}/600</p>
        </div>

        <div className="space-y-2">
          <Label>Quando NÃO recomendar</Label>
          <Textarea
            value={whenNot}
            onChange={(e) => setWhenNot(e.target.value)}
            placeholder="Ex: pele sensível, alergia a fragrância, gestantes..."
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label>Observações para a IA</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value.slice(0, 1000))}
            placeholder="Notas livres que a IA deve considerar."
            rows={2}
          />
          <p className="text-xs text-muted-foreground">{notes.length}/1000</p>
        </div>

        <RelationsManager
          tenantId={tenantId}
          productId={productId}
          relations={relations}
          onAdd={(target_product_id, relation_type) => addRelation.mutate({ target_product_id, relation_type })}
          onRemove={(id) => removeRelation.mutate(id)}
        />

        <div className="flex justify-end pt-2">
          <Button type="button" onClick={handleSave} disabled={savePayload.isPending || isLoading}>
            {savePayload.isPending ? "Salvando..." : "Salvar Visão da IA"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------- Base Product Picker ----------
function BaseProductPicker({
  tenantId,
  currentProductId,
  value,
  onChange,
}: {
  tenantId?: string;
  currentProductId: string;
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const [search, setSearch] = useState("");
  const { data } = useQuery({
    queryKey: ["product-base-search", tenantId, search],
    enabled: !!tenantId,
    queryFn: async () => {
      let q = (supabase as any)
        .from("products")
        .select("id,name,sku")
        .eq("tenant_id", tenantId)
        .neq("id", currentProductId)
        .neq("status", "archived")
        .limit(20);
      if (search) q = q.ilike("name", `%${search}%`);
      const { data } = await q;
      return (data || []) as { id: string; name: string; sku: string | null }[];
    },
  });
  const selected = data?.find((p) => p.id === value);
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <Label>Produto-base relacionado</Label>
      <p className="text-xs text-muted-foreground">
        Aponte para o produto-base puro (ex: Balm 2x → Balm 1x).
      </p>
      <Input
        placeholder="Buscar produto..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {selected && (
        <div className="flex items-center justify-between rounded bg-muted p-2 text-sm">
          <span>{selected.name} {selected.sku && <span className="text-muted-foreground">({selected.sku})</span>}</span>
          <Button type="button" size="sm" variant="ghost" onClick={() => onChange(null)}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}
      {!selected && data && data.length > 0 && (
        <div className="max-h-40 overflow-y-auto rounded border">
          {data.map((p) => (
            <button
              key={p.id}
              type="button"
              className="w-full px-2 py-1.5 text-left text-sm hover:bg-muted"
              onClick={() => onChange(p.id)}
            >
              {p.name} {p.sku && <span className="text-muted-foreground">({p.sku})</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Relations Manager ----------
const REL_LABELS: Record<RelationType, string> = {
  complement: "Complementares",
  related_base: "Bases relacionadas",
  upsell: "Upsell",
  cross_sell: "Cross-sell",
};

function RelationsManager({
  tenantId,
  productId,
  relations,
  onAdd,
  onRemove,
}: {
  tenantId?: string;
  productId: string;
  relations: any[];
  onAdd: (target: string, type: RelationType) => void;
  onRemove: (id: string) => void;
}) {
  const [type, setType] = useState<RelationType>("complement");
  const [search, setSearch] = useState("");

  const { data } = useQuery({
    queryKey: ["product-rel-search", tenantId, search],
    enabled: !!tenantId && search.length >= 2,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("products")
        .select("id,name,sku")
        .eq("tenant_id", tenantId)
        .neq("id", productId)
        .neq("status", "archived")
        .ilike("name", `%${search}%`)
        .limit(10);
      return (data || []) as { id: string; name: string; sku: string | null }[];
    },
  });

  const grouped = relations.reduce((acc: Record<string, any[]>, r) => {
    (acc[r.relation_type] = acc[r.relation_type] || []).push(r);
    return acc;
  }, {});

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <Label>Produtos relacionados</Label>
      <p className="text-xs text-muted-foreground">
        Use complementares para itens que combinam (ex: Shampoo + Balm). Use upsell/cross-sell para sugestões na vitrine.
      </p>

      <div className="flex gap-2">
        <Select value={type} onValueChange={(v) => setType(v as RelationType)}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.keys(REL_LABELS) as RelationType[]).map((k) => (
              <SelectItem key={k} value={k}>{REL_LABELS[k]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="Buscar produto para vincular..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {data && data.length > 0 && search.length >= 2 && (
        <div className="max-h-40 overflow-y-auto rounded border">
          {data.map((p) => (
            <button
              key={p.id}
              type="button"
              className="flex w-full items-center justify-between px-2 py-1.5 text-left text-sm hover:bg-muted"
              onClick={() => { onAdd(p.id, type); setSearch(""); }}
            >
              <span>{p.name} {p.sku && <span className="text-muted-foreground">({p.sku})</span>}</span>
              <Plus className="h-3 w-3" />
            </button>
          ))}
        </div>
      )}

      {(Object.keys(REL_LABELS) as RelationType[]).map((rt) => {
        const items = grouped[rt] || [];
        if (items.length === 0) return null;
        return (
          <div key={rt} className="space-y-1">
            <p className="text-xs font-medium">{REL_LABELS[rt]}</p>
            {items.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded bg-muted px-2 py-1 text-sm">
                <span>{r.target?.name ?? "(produto removido)"} {r.target?.sku && <span className="text-muted-foreground">({r.target.sku})</span>}</span>
                <Button type="button" size="sm" variant="ghost" onClick={() => onRemove(r.id)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
