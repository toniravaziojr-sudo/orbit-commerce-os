// =============================================
// B2B SEARCH TAB - Busca por CNPJ, CNAE, Cidade/UF
// =============================================

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Search, Building2, MapPin, Hash, Loader2, CheckCircle, XCircle, Plus } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatCnpj, extractDigits } from "@/lib/formatCnpj";
import B2BEntityCard from "./B2BEntityCard";

// Estados brasileiros
const UF_LIST = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

interface SearchResult {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  cnae_principal: string;
  cnae_descricao: string;
  situacao_cadastral: string;
  porte: string;
  logradouro: string;
  numero: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  telefone: string;
  email: string;
  data_abertura: string;
  capital_social: number;
}

export default function B2BSearchTab() {
  const { currentTenant, user } = useAuth();
  const [searchType, setSearchType] = useState<"cnpj" | "cnae">("cnpj");
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [savedEntities, setSavedEntities] = useState<Set<string>>(new Set());
  
  // CNPJ search
  const [cnpjInput, setCnpjInput] = useState("");
  
  // CNAE search
  const [uf, setUf] = useState("");
  const [cidade, setCidade] = useState("");
  const [cnaeCode, setCnaeCode] = useState("");
  const [nicho, setNicho] = useState("");

  const handleCnpjSearch = async () => {
    const cleanCnpj = extractDigits(cnpjInput);
    
    if (cleanCnpj.length !== 14) {
      toast.error("CNPJ deve ter 14 dígitos");
      return;
    }

    if (!currentTenant?.id) {
      toast.error("Selecione uma loja primeiro");
      return;
    }

    setIsLoading(true);
    setResults([]);

    try {
      const { data, error } = await supabase.functions.invoke("b2b-search", {
        body: {
          action: "search_cnpj",
          cnpj: cleanCnpj,
          tenant_id: currentTenant.id,
        },
      });

      if (error) throw error;

      if (data?.success && data?.entity) {
        setResults([data.entity]);
        toast.success("Empresa encontrada!");
      } else {
        toast.error(data?.error || "Empresa não encontrada");
      }
    } catch (err: any) {
      console.error("CNPJ search error:", err);
      toast.error(err.message || "Erro ao buscar CNPJ");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCnaeSearch = async () => {
    if (!uf) {
      toast.error("Selecione um estado");
      return;
    }

    if (!currentTenant?.id) {
      toast.error("Selecione uma loja primeiro");
      return;
    }

    setIsLoading(true);
    setResults([]);

    try {
      const { data, error } = await supabase.functions.invoke("b2b-search", {
        body: {
          action: "search_cnae",
          uf,
          cidade: cidade || undefined,
          cnae: cnaeCode || undefined,
          nicho: nicho || undefined,
          tenant_id: currentTenant.id,
        },
      });

      if (error) throw error;

      if (data?.success && data?.entities?.length > 0) {
        setResults(data.entities);
        toast.success(`${data.entities.length} empresas encontradas!`);
      } else {
        toast.info("Nenhuma empresa encontrada com esses critérios");
      }
    } catch (err: any) {
      console.error("CNAE search error:", err);
      toast.error(err.message || "Erro na busca");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveEntity = async (entity: SearchResult) => {
    if (!currentTenant?.id || !user?.id) {
      toast.error("Erro de autenticação");
      return;
    }

    try {
      const { error } = await supabase.from("b2b_entities").insert({
        tenant_id: currentTenant.id,
        cnpj: extractDigits(entity.cnpj),
        razao_social: entity.razao_social,
        nome_fantasia: entity.nome_fantasia,
        cnae_principal: entity.cnae_principal,
        cnae_descricao: entity.cnae_descricao,
        situacao_cadastral: entity.situacao_cadastral,
        porte: entity.porte,
        logradouro: entity.logradouro,
        numero: entity.numero,
        bairro: entity.bairro,
        cidade: entity.cidade,
        uf: entity.uf,
        cep: entity.cep,
        telefone: entity.telefone,
        email: entity.email,
        data_abertura: entity.data_abertura || null,
        capital_social: entity.capital_social || null,
        source_type: "cnpj_api",
        source_provider: "brasilapi",
      });

      if (error) {
        if (error.code === "23505") {
          toast.info("Empresa já está salva");
        } else {
          throw error;
        }
      } else {
        setSavedEntities((prev) => new Set([...prev, entity.cnpj]));
        toast.success("Empresa salva com sucesso!");
      }
    } catch (err: any) {
      console.error("Save entity error:", err);
      toast.error("Erro ao salvar empresa");
    }
  };

  const handleSaveAll = async () => {
    for (const entity of results) {
      if (!savedEntities.has(entity.cnpj)) {
        await handleSaveEntity(entity);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Search Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Buscar Empresas
          </CardTitle>
          <CardDescription>
            Pesquise por CNPJ específico ou por critérios como CNAE, cidade e estado
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={searchType} onValueChange={(v) => setSearchType(v as "cnpj" | "cnae")}>
            <TabsList className="mb-4">
              <TabsTrigger value="cnpj" className="flex items-center gap-2">
                <Hash className="h-4 w-4" />
                Por CNPJ
              </TabsTrigger>
              <TabsTrigger value="cnae" className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Por Região/CNAE
              </TabsTrigger>
            </TabsList>

            <TabsContent value="cnpj" className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <Label htmlFor="cnpj">CNPJ</Label>
                  <Input
                    id="cnpj"
                    placeholder="00.000.000/0000-00"
                    value={formatCnpj(cnpjInput)}
                    onChange={(e) => setCnpjInput(extractDigits(e.target.value))}
                    maxLength={18}
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={handleCnpjSearch} disabled={isLoading}>
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                    <span className="ml-2">Buscar</span>
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="cnae" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <Label htmlFor="uf">Estado *</Label>
                  <Select value={uf} onValueChange={setUf}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {UF_LIST.map((state) => (
                        <SelectItem key={state} value={state}>
                          {state}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="cidade">Cidade</Label>
                  <Input
                    id="cidade"
                    placeholder="Ex: São Paulo"
                    value={cidade}
                    onChange={(e) => setCidade(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="cnae">CNAE</Label>
                  <Input
                    id="cnae"
                    placeholder="Ex: 4711-3"
                    value={cnaeCode}
                    onChange={(e) => setCnaeCode(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="nicho">Palavra-chave</Label>
                  <Input
                    id="nicho"
                    placeholder="Ex: restaurante"
                    value={nicho}
                    onChange={(e) => setNicho(e.target.value)}
                  />
                </div>
              </div>
              <Button onClick={handleCnaeSearch} disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                <span className="ml-2">Buscar</span>
              </Button>
              <p className="text-xs text-muted-foreground">
                * A busca por CNAE/região utiliza APIs públicas com limite de consultas.
              </p>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Results */}
      {results.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Resultados ({results.length})
                </CardTitle>
                <CardDescription>
                  Clique em "Salvar" para adicionar à sua base de prospecção
                </CardDescription>
              </div>
              {results.length > 1 && (
                <Button variant="outline" onClick={handleSaveAll}>
                  <Plus className="h-4 w-4 mr-2" />
                  Salvar Todos
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {results.map((entity) => (
                <B2BEntityCard
                  key={entity.cnpj}
                  entity={entity}
                  isSaved={savedEntities.has(entity.cnpj)}
                  onSave={() => handleSaveEntity(entity)}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
