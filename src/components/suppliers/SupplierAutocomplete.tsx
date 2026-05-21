import { useEffect, useRef, useState } from "react";
import { Loader2, Search, X, BookmarkPlus, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSuppliers, type Supplier, type SupplierPersonType } from "@/hooks/useSuppliers";
import { toast } from "sonner";

export interface SupplierContact {
  id?: string | null;
  name: string;
  document: string; // CPF ou CNPJ (somente dígitos)
  personType?: SupplierPersonType;
  email?: string | null;
  phone?: string | null;
  ie?: string | null;
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
}

interface SupplierAutocompleteProps {
  value: SupplierContact;
  onChange: (next: SupplierContact) => void;
  label?: string;
  required?: boolean;
  allowSave?: boolean;
}

function onlyDigits(v: string | null | undefined): string {
  return (v ?? "").replace(/\D/g, "");
}

function inferPersonType(doc: string): SupplierPersonType {
  return onlyDigits(doc).length > 11 ? "PJ" : "PF";
}

export function SupplierAutocomplete({
  value,
  onChange,
  label = "Fornecedor",
  required,
  allowSave = true,
}: SupplierAutocompleteProps) {
  const { profile } = useAuth();
  const tenantId = profile?.current_tenant_id;
  const { createSupplier, updateSupplier, findByDocument } = useSuppliers();

  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<Supplier[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Duplicate-detection dialog state
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [existingMatch, setExistingMatch] = useState<Supplier | null>(null);
  const [saving, setSaving] = useState(false);

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Debounced search
  useEffect(() => {
    if (!tenantId || !searchTerm || searchTerm.trim().length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const term = searchTerm.trim();
        const digits = term.replace(/\D/g, "");
        const filters: string[] = [`name.ilike.%${term}%`, `legal_name.ilike.%${term}%`, `trade_name.ilike.%${term}%`];
        if (digits.length >= 3) {
          filters.push(`cnpj.ilike.%${digits}%`);
          filters.push(`cpf.ilike.%${digits}%`);
        }
        const { data, error } = await supabase
          .from("suppliers")
          .select("*")
          .eq("tenant_id", tenantId)
          .is("deleted_at", null)
          .or(filters.join(","))
          .limit(10);
        if (error) throw error;
        setResults((data ?? []) as unknown as Supplier[]);
      } catch (err) {
        console.error("Erro ao buscar fornecedores:", err);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [searchTerm, tenantId]);

  function applySupplier(s: Supplier) {
    onChange({
      id: s.id,
      name: s.name,
      document: (s.cnpj || s.cpf || "") as string,
      personType: s.person_type,
      email: s.email,
      phone: s.phone,
      ie: s.ie,
      cep: s.cep,
      logradouro: s.logradouro,
      numero: s.numero,
      complemento: s.complemento,
      bairro: s.bairro,
      cidade: s.cidade,
      uf: s.uf,
    });
    setSearchTerm("");
    setResults([]);
    setOpen(false);
    toast.success(`Fornecedor "${s.name}" selecionado`);
  }

  function clearSelection() {
    onChange({ id: null, name: "", document: "", personType: undefined });
  }

  async function handleSaveToBase() {
    const docDigits = onlyDigits(value.document);
    if (!value.name?.trim()) {
      toast.error("Informe o nome do fornecedor");
      return;
    }
    if (!docDigits || (docDigits.length !== 11 && docDigits.length !== 14)) {
      toast.error("Informe um CPF ou CNPJ válido para salvar na base");
      return;
    }
    const personType = inferPersonType(docDigits);
    try {
      setSaving(true);
      const existing = await findByDocument(docDigits, personType);
      if (existing) {
        setExistingMatch(existing);
        setDuplicateOpen(true);
        return;
      }
      const created = await createSupplier.mutateAsync({
        name: value.name.trim(),
        person_type: personType,
        cnpj: personType === "PJ" ? docDigits : null,
        cpf: personType === "PF" ? docDigits : null,
        legal_name: personType === "PJ" ? value.name.trim() : null,
        trade_name: null,
        ie: value.ie ?? null,
        ie_isento: false,
        im: null,
        contributor_type: "nao_contribuinte",
        is_foreign: false,
        email: value.email ?? null,
        phone: value.phone ?? null,
        phone_secondary: null,
        cep: value.cep ?? null,
        logradouro: value.logradouro ?? null,
        numero: value.numero ?? null,
        complemento: value.complemento ?? null,
        bairro: value.bairro ?? null,
        cidade: value.cidade ?? null,
        uf: value.uf ?? null,
        codigo_ibge: null,
        pais: "Brasil",
        address: null,
        contact_person: null,
        notes: null,
        fiscal_notes: null,
        is_active: true,
        supplier_type_id: null,
      } as any);
      onChange({ ...value, id: (created as any).id, personType });
    } catch (err) {
      // toast already shown by hook
    } finally {
      setSaving(false);
    }
  }

  async function handleUseExisting() {
    if (!existingMatch) return;
    applySupplier(existingMatch);
    setDuplicateOpen(false);
    setExistingMatch(null);
  }

  async function handleUpdateExisting() {
    if (!existingMatch) return;
    try {
      setSaving(true);
      await updateSupplier.mutateAsync({
        id: existingMatch.id,
        name: value.name.trim() || existingMatch.name,
        email: value.email ?? existingMatch.email,
        phone: value.phone ?? existingMatch.phone,
        ie: value.ie ?? existingMatch.ie,
        cep: value.cep ?? existingMatch.cep,
        logradouro: value.logradouro ?? existingMatch.logradouro,
        numero: value.numero ?? existingMatch.numero,
        complemento: value.complemento ?? existingMatch.complemento,
        bairro: value.bairro ?? existingMatch.bairro,
        cidade: value.cidade ?? existingMatch.cidade,
        uf: value.uf ?? existingMatch.uf,
      } as any);
      onChange({
        ...value,
        id: existingMatch.id,
        personType: existingMatch.person_type,
      });
      setDuplicateOpen(false);
      setExistingMatch(null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3" ref={containerRef}>
      {/* Search base */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Buscar na base de fornecedores</Label>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="Nome, CNPJ ou CPF"
            className="pl-8"
          />
          {searching && (
            <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
          {open && results.length > 0 && (
            <div className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-popover shadow-md">
              {results.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => applySupplier(s)}
                  className="flex w-full flex-col items-start gap-0.5 border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-accent"
                >
                  <span className="font-medium">{s.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {s.person_type === "PJ" ? `CNPJ ${s.cnpj ?? "—"}` : `CPF ${s.cpf ?? "—"}`}
                    {s.cidade ? ` • ${s.cidade}/${s.uf ?? ""}` : ""}
                  </span>
                </button>
              ))}
            </div>
          )}
          {open && !searching && searchTerm.length >= 2 && results.length === 0 && (
            <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover px-3 py-2 text-xs text-muted-foreground shadow-md">
              Nenhum fornecedor encontrado. Preencha os campos abaixo e use "Salvar na base".
            </div>
          )}
        </div>
      </div>

      {/* Manual fields */}
      <div className="space-y-2 rounded-md border bg-muted/30 p-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium">
            {label}
            {required && " *"}
          </Label>
          {value.id ? (
            <Badge variant="outline" className="gap-1 text-xs">
              <Check className="h-3 w-3" /> Vinculado à base
            </Badge>
          ) : value.name || value.document ? (
            <Badge variant="secondary" className="text-xs">Manual</Badge>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label className="text-xs">Nome / Razão Social</Label>
            <Input
              value={value.name}
              onChange={(e) => onChange({ ...value, id: null, name: e.target.value })}
              placeholder="Nome do fornecedor"
            />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs">CPF / CNPJ</Label>
            <Input
              value={value.document}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, "");
                onChange({
                  ...value,
                  id: null,
                  document: digits,
                  personType: inferPersonType(digits),
                });
              }}
              placeholder="Apenas números"
              maxLength={14}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
          {(value.id || value.name || value.document) && (
            <Button type="button" variant="ghost" size="sm" onClick={clearSelection}>
              <X className="mr-1 h-3.5 w-3.5" /> Limpar
            </Button>
          )}
          {allowSave && !value.id && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSaveToBase}
              disabled={saving || !value.name.trim() || !value.document}
            >
              {saving ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <BookmarkPlus className="mr-1 h-3.5 w-3.5" />
              )}
              Salvar na base
            </Button>
          )}
        </div>
      </div>

      {/* Duplicate dialog */}
      <Dialog open={duplicateOpen} onOpenChange={setDuplicateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Fornecedor já existe na base</DialogTitle>
            <DialogDescription>
              Já existe um cadastro com este {existingMatch?.person_type === "PJ" ? "CNPJ" : "CPF"}:
              <br />
              <strong>{existingMatch?.name}</strong>
              <br />
              {existingMatch?.person_type === "PJ"
                ? `CNPJ ${existingMatch?.cnpj}`
                : `CPF ${existingMatch?.cpf}`}
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            O que deseja fazer?
          </p>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="ghost" onClick={() => setDuplicateOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button variant="outline" onClick={handleUseExisting} disabled={saving}>
              Usar cadastro existente
            </Button>
            <Button onClick={handleUpdateExisting} disabled={saving}>
              {saving && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
              Atualizar dados
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
