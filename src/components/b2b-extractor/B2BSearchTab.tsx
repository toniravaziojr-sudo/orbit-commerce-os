// =============================================
// B2B SEARCH TAB - Busca por Nicho + Localidade
// =============================================

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Search, Building2, MapPin, Hash, Loader2, Plus, Sparkles, Tag } from "lucide-react";
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

// Categorias de nichos organizadas por segmento
const NICHO_CATEGORIES = [
  {
    category: "🏭 Indústrias & Fábricas",
    nichos: [
      { label: "Fábrica de Alimentos", keywords: ["fabrica alimentos", "industria alimenticia"], icon: "🏭", cnae: "1091-1" },
      { label: "Fábrica de Roupas", keywords: ["confeccao", "fabrica roupas", "industria textil"], icon: "🧵", cnae: "1412-6" },
      { label: "Fábrica de Cosméticos", keywords: ["industria cosmetico", "fabrica perfume"], icon: "🧴", cnae: "2063-1" },
      { label: "Fábrica de Móveis", keywords: ["industria moveis", "fabrica moveis"], icon: "🪑", cnae: "3101-2" },
      { label: "Metalúrgica", keywords: ["metalurgica", "siderurgica", "ferro"], icon: "⚙️", cnae: "2599-3" },
      { label: "Fábrica de Plásticos", keywords: ["industria plastico", "fabrica plastico"], icon: "🧪", cnae: "2229-3" },
      { label: "Fábrica de Calçados", keywords: ["fabrica calcados", "industria calcados"], icon: "👟", cnae: "1539-4" },
      { label: "Fábrica de Bebidas", keywords: ["fabrica bebidas", "industria bebidas"], icon: "🍺", cnae: "1121-6" },
    ]
  },
  {
    category: "🛍️ Comércios Varejistas",
    nichos: [
      { label: "Cosméticos", keywords: ["cosmetico", "beleza", "perfumaria", "maquiagem"], icon: "💄", cnae: "4772-5" },
      { label: "Eletrônicos", keywords: ["eletronico", "informatica", "celular", "tecnologia"], icon: "📱", cnae: "4751-2" },
      { label: "Moda e Vestuário", keywords: ["roupa", "vestuario", "moda", "calcado", "acessorio"], icon: "👗", cnae: "4781-4" },
      { label: "Casa e Decoração", keywords: ["moveis", "decoracao", "casa", "cama mesa banho"], icon: "🏠", cnae: "4754-7" },
      { label: "Pet Shop", keywords: ["pet", "animal", "veterinaria", "racao"], icon: "🐾", cnae: "4789-0" },
      { label: "Farmácia", keywords: ["farmacia", "drogaria", "medicamento"], icon: "💊", cnae: "4771-7" },
      { label: "Supermercado", keywords: ["supermercado", "mercado", "mercearia"], icon: "🛒", cnae: "4711-3" },
      { label: "Material de Construção", keywords: ["construcao", "material", "ferragem"], icon: "🔨", cnae: "4744-0" },
      { label: "Papelaria", keywords: ["papelaria", "escritorio", "livraria"], icon: "📝", cnae: "4761-0" },
      { label: "Joalheria", keywords: ["joalheria", "relojoaria", "bijuteria"], icon: "💎", cnae: "4783-1" },
      { label: "Ótica", keywords: ["otica", "oculos", "lentes"], icon: "👓", cnae: "4774-1" },
      { label: "Brinquedos", keywords: ["brinquedo", "loja brinquedo"], icon: "🧸", cnae: "4763-6" },
    ]
  },
  {
    category: "📦 Atacadistas & Distribuidores",
    nichos: [
      { label: "Atacadista Alimentos", keywords: ["atacado alimentos", "distribuidor alimentos"], icon: "📦", cnae: "4639-7" },
      { label: "Atacadista Bebidas", keywords: ["atacado bebidas", "distribuidor bebidas"], icon: "🍷", cnae: "4635-4" },
      { label: "Atacadista Cosméticos", keywords: ["atacado cosmeticos", "distribuidor cosmeticos"], icon: "🧴", cnae: "4646-0" },
      { label: "Atacadista Roupas", keywords: ["atacado roupas", "distribuidor vestuario"], icon: "👕", cnae: "4642-7" },
      { label: "Atacadista Eletrônicos", keywords: ["atacado eletronico", "distribuidor informatica"], icon: "💻", cnae: "4651-6" },
      { label: "Atacadista Materiais", keywords: ["atacado construcao", "distribuidor material"], icon: "🧱", cnae: "4679-6" },
    ]
  },
  {
    category: "🍽️ Alimentação",
    nichos: [
      { label: "Restaurante", keywords: ["restaurante", "alimentacao", "comida"], icon: "🍽️", cnae: "5611-2" },
      { label: "Lanchonete", keywords: ["lanchonete", "fast food", "hamburguer"], icon: "🍔", cnae: "5611-2" },
      { label: "Pizzaria", keywords: ["pizzaria", "pizza"], icon: "🍕", cnae: "5611-2" },
      { label: "Cafeteria", keywords: ["cafeteria", "cafe", "padaria"], icon: "☕", cnae: "5611-2" },
      { label: "Açougue", keywords: ["acougue", "carne", "frigorifico"], icon: "🥩", cnae: "4722-9" },
      { label: "Hortifruti", keywords: ["hortifruti", "frutas", "verduras"], icon: "🥬", cnae: "4724-5" },
      { label: "Doceria", keywords: ["doceria", "confeitaria", "bolos"], icon: "🎂", cnae: "1091-1" },
    ]
  },
  {
    category: "🏥 Saúde & Bem-estar",
    nichos: [
      { label: "Clínica Médica", keywords: ["clinica", "consultorio", "medico"], icon: "🏥", cnae: "8630-5" },
      { label: "Clínica Odontológica", keywords: ["dentista", "odontologia", "clinica dental"], icon: "🦷", cnae: "8630-5" },
      { label: "Clínica Estética", keywords: ["estetica", "clinica beleza", "procedimentos"], icon: "✨", cnae: "9602-5" },
      { label: "Academia", keywords: ["academia", "fitness", "esporte", "crossfit"], icon: "🏋️", cnae: "9313-1" },
      { label: "Salão de Beleza", keywords: ["salao", "cabeleireiro", "barbearia"], icon: "💇", cnae: "9602-5" },
      { label: "Spa", keywords: ["spa", "massagem", "relaxamento"], icon: "🧖", cnae: "9609-2" },
      { label: "Laboratório", keywords: ["laboratorio", "exames", "analises"], icon: "🔬", cnae: "8640-2" },
    ]
  },
  {
    category: "🏢 Serviços & Imóveis",
    nichos: [
      { label: "Imobiliária", keywords: ["imovel", "imobiliaria", "corretora", "aluguel"], icon: "🏢", cnae: "6821-8" },
      { label: "Contabilidade", keywords: ["contabilidade", "contador", "escritorio contabil"], icon: "📊", cnae: "6920-6" },
      { label: "Advocacia", keywords: ["advocacia", "advogado", "escritorio advocacia"], icon: "⚖️", cnae: "6911-7" },
      { label: "Agência Marketing", keywords: ["marketing", "publicidade", "agencia digital"], icon: "📣", cnae: "7311-4" },
      { label: "Coworking", keywords: ["coworking", "escritorio compartilhado"], icon: "💼", cnae: "8211-3" },
      { label: "Segurança", keywords: ["seguranca", "vigilancia", "monitoramento"], icon: "🛡️", cnae: "8011-1" },
    ]
  },
  {
    category: "🚗 Automotivo",
    nichos: [
      { label: "Loja de Autopeças", keywords: ["autopeca", "peca carro", "loja autopeca"], icon: "🔧", cnae: "4530-7" },
      { label: "Oficina Mecânica", keywords: ["mecanica", "oficina", "conserto carro"], icon: "🔩", cnae: "4520-0" },
      { label: "Concessionária", keywords: ["concessionaria", "revenda carro", "loja carro"], icon: "🚗", cnae: "4511-1" },
      { label: "Lava-Jato", keywords: ["lava jato", "lavagem carro", "lava rapido"], icon: "🚿", cnae: "4520-0" },
      { label: "Borracharia", keywords: ["borracharia", "pneu", "troca pneu"], icon: "⚫", cnae: "4520-0" },
      { label: "Auto Elétrica", keywords: ["auto eletrica", "eletrica carro"], icon: "⚡", cnae: "4520-0" },
    ]
  },
  {
    category: "📚 Educação",
    nichos: [
      { label: "Escola", keywords: ["escola", "colegio", "ensino"], icon: "🏫", cnae: "8513-9" },
      { label: "Curso de Idiomas", keywords: ["idiomas", "ingles", "espanhol", "escola idiomas"], icon: "🌐", cnae: "8593-7" },
      { label: "Curso Profissionalizante", keywords: ["curso", "profissionalizante", "tecnico"], icon: "📚", cnae: "8599-6" },
      { label: "Escola de Música", keywords: ["musica", "escola musica", "aula musica"], icon: "🎵", cnae: "8592-9" },
      { label: "Auto Escola", keywords: ["autoescola", "cfc", "habilitacao"], icon: "🚘", cnae: "8599-6" },
    ]
  },
  {
    category: "🎉 Eventos & Festas",
    nichos: [
      { label: "Buffet", keywords: ["buffet", "festa", "eventos"], icon: "🎊", cnae: "5620-1" },
      { label: "Casa de Festas", keywords: ["casa festas", "salao festas", "eventos"], icon: "🎈", cnae: "9329-8" },
      { label: "Decoração de Festas", keywords: ["decoracao festa", "baloes", "ornamentacao"], icon: "🎀", cnae: "9329-8" },
      { label: "DJ e Som", keywords: ["dj", "som", "iluminacao", "eventos"], icon: "🎧", cnae: "9001-9" },
      { label: "Fotografia", keywords: ["fotografia", "fotografo", "estudio foto"], icon: "📷", cnae: "7420-0" },
    ]
  },
  {
    category: "🌾 Agronegócio",
    nichos: [
      { label: "Loja Agropecuária", keywords: ["agropecuaria", "agro", "insumos agricolas"], icon: "🌾", cnae: "4789-0" },
      { label: "Veterinária Rural", keywords: ["veterinaria", "animal", "gado"], icon: "🐄", cnae: "7500-1" },
      { label: "Máquinas Agrícolas", keywords: ["maquinas agricolas", "trator", "implementos"], icon: "🚜", cnae: "4661-3" },
      { label: "Sementes e Mudas", keywords: ["sementes", "mudas", "viveiro"], icon: "🌱", cnae: "0121-1" },
    ]
  },
];

// Lista flat para renderização
const NICHOS_SUGERIDOS = NICHO_CATEGORIES.flatMap(cat => cat.nichos);

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
  const [searchType, setSearchType] = useState<"nicho" | "cnpj">("nicho");
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [savedEntities, setSavedEntities] = useState<Set<string>>(new Set());
  
  // Nicho search
  const [selectedNicho, setSelectedNicho] = useState<string>("");
  const [customNicho, setCustomNicho] = useState("");
  const [uf, setUf] = useState("");
  const [cidade, setCidade] = useState("");
  
  // CNPJ search
  const [cnpjInput, setCnpjInput] = useState("");

  const getNichoInfo = () => {
    if (selectedNicho) {
      return NICHOS_SUGERIDOS.find(n => n.label === selectedNicho);
    }
    return null;
  };

  const handleNichoSearch = async () => {
    if (!uf) {
      toast.error("Selecione um estado");
      return;
    }

    if (!selectedNicho && !customNicho) {
      toast.error("Selecione ou digite um nicho");
      return;
    }

    if (!currentTenant?.id) {
      toast.error("Selecione uma loja primeiro");
      return;
    }

    setIsLoading(true);
    setResults([]);

    const nichoInfo = getNichoInfo();
    const searchKeyword = customNicho || nichoInfo?.keywords[0] || selectedNicho.toLowerCase();
    const cnaeCode = nichoInfo?.cnae;

    try {
      const { data, error } = await supabase.functions.invoke("b2b-search", {
        body: {
          action: "search_nicho",
          uf,
          cidade: cidade || undefined,
          cnae: cnaeCode || undefined,
          nicho: searchKeyword,
          tenant_id: currentTenant.id,
        },
      });

      if (error) throw error;

      if (data?.success && data?.entities?.length > 0) {
        setResults(data.entities);
        toast.success(`${data.entities.length} empresas encontradas!`);
      } else if (data?.code === "NICHO_NOT_IMPLEMENTED") {
        // Fallback: mostrar mensagem informativa
        toast.info(
          "A busca em lote por nicho requer integração com provedor de dados. " +
          "Por enquanto, use a busca por CNPJ específico.",
          { duration: 5000 }
        );
      } else {
        toast.info(data?.error || "Nenhuma empresa encontrada com esses critérios");
      }
    } catch (err: any) {
      console.error("Nicho search error:", err);
      toast.error(err.message || "Erro na busca");
    } finally {
      setIsLoading(false);
    }
  };

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
            Escolha um nicho de mercado e uma localidade para encontrar empresas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={searchType} onValueChange={(v) => setSearchType(v as "nicho" | "cnpj")}>
            <TabsList className="mb-4">
              <TabsTrigger value="nicho" className="flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Por Nicho + Localidade
              </TabsTrigger>
              <TabsTrigger value="cnpj" className="flex items-center gap-2">
                <Hash className="h-4 w-4" />
                Por CNPJ
              </TabsTrigger>
            </TabsList>

            <TabsContent value="nicho" className="space-y-6">
              {/* Nichos Sugeridos por Categoria */}
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                <Label className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Selecione um Nicho
                </Label>
                {NICHO_CATEGORIES.map((cat) => (
                  <div key={cat.category} className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">{cat.category}</p>
                    <div className="flex flex-wrap gap-2">
                      {cat.nichos.map((nicho) => (
                        <Badge
                          key={nicho.label}
                          variant={selectedNicho === nicho.label ? "default" : "outline"}
                          className="cursor-pointer text-sm py-2 px-3 hover:bg-primary/10 transition-colors"
                          onClick={() => {
                            setSelectedNicho(selectedNicho === nicho.label ? "" : nicho.label);
                            setCustomNicho("");
                          }}
                        >
                          <span className="mr-1">{nicho.icon}</span>
                          {nicho.label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Nicho Personalizado */}
              <div className="space-y-2">
                <Label htmlFor="custom-nicho">Ou digite um nicho personalizado</Label>
                <Input
                  id="custom-nicho"
                  placeholder="Ex: barbearia, coworking, papelaria..."
                  value={customNicho}
                  onChange={(e) => {
                    setCustomNicho(e.target.value);
                    setSelectedNicho("");
                  }}
                />
              </div>

              {/* Localidade */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="uf">Estado *</Label>
                  <Select value={uf} onValueChange={setUf}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o estado" />
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
                <div className="space-y-2">
                  <Label htmlFor="cidade">Cidade (opcional)</Label>
                  <Input
                    id="cidade"
                    placeholder="Ex: São Paulo"
                    value={cidade}
                    onChange={(e) => setCidade(e.target.value)}
                  />
                </div>
              </div>

              {/* Resumo da busca */}
              {(selectedNicho || customNicho) && uf && (
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm">
                    <span className="font-medium">Buscando:</span>{" "}
                    <span className="text-primary font-semibold">
                      {selectedNicho || customNicho}
                    </span>
                    {" em "}
                    <span className="font-semibold">
                      {cidade ? `${cidade}/${uf}` : uf}
                    </span>
                    {getNichoInfo()?.cnae && (
                      <span className="text-muted-foreground text-xs ml-2">
                        (CNAE: {getNichoInfo()?.cnae})
                      </span>
                    )}
                  </p>
                </div>
              )}

              <Button 
                onClick={handleNichoSearch} 
                disabled={isLoading || (!selectedNicho && !customNicho) || !uf}
                size="lg"
                className="w-full md:w-auto"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Search className="h-4 w-4 mr-2" />
                )}
                Buscar Empresas
              </Button>
              
              <p className="text-xs text-muted-foreground">
                ⚠️ A busca em lote por nicho requer integração com provedor de dados empresariais. 
                Para busca imediata, use a aba "Por CNPJ" com CNPJs específicos.
              </p>
            </TabsContent>

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
              <p className="text-xs text-muted-foreground">
                Consulta dados públicos via BrasilAPI (CNPJ, endereço, situação cadastral).
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
