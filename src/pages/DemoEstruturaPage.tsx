import { Button } from "@/components/ui/button";
import { ArrowRight, Check, Droplets, Zap, Shield, Clock, Leaf } from "lucide-react";

/**
 * Página de demonstração: como ficaria uma página de apresentação de produto
 * quando construída com blocos nativos do Builder (estrutura editável).
 * 
 * Esta página simula o resultado de uma "Importação por Estrutura"
 * onde o visual é reinventado usando o tema do sistema.
 */
export default function DemoEstruturaPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ========== SEÇÃO 1: HERO PRINCIPAL ========== */}
      <section className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white py-20 md:py-32">
        <div className="container mx-auto px-4 text-center">
          <p className="text-primary/80 uppercase tracking-widest text-sm mb-4">
            Tratamento Capilar Avançado
          </p>
          <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
            RECUPERE GRADUALMENTE<br />
            <span className="text-primary">SEUS CABELOS</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-300 max-w-2xl mx-auto mb-8">
            O shampoo mais completo para combater a calvície e fortalecer os fios desde a raiz.
          </p>
          <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-6 text-lg">
            COMPRAR AGORA <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>

      {/* ========== SEÇÃO 2: PRODUTO + BENEFÍCIOS ========== */}
      <section className="py-16 md:py-24 bg-background">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* Imagem do Produto */}
            <div className="bg-muted rounded-2xl p-8 flex items-center justify-center min-h-[400px]">
              <div className="text-center text-muted-foreground">
                <Droplets className="h-24 w-24 mx-auto mb-4 opacity-50" />
                <p className="text-sm">Imagem do Produto</p>
                <p className="text-xs opacity-60">(Bloco: Image)</p>
              </div>
            </div>

            {/* Conteúdo */}
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">
                Shampoo Calvície Zero
              </h2>
              <p className="text-muted-foreground text-lg mb-6">
                Fórmula exclusiva desenvolvida por especialistas para tratar a calvície de forma natural e eficaz.
              </p>
              
              <ul className="space-y-4 mb-8">
                {[
                  "Fortalece os fios desde a raiz",
                  "Estimula o crescimento capilar",
                  "Combate a queda de cabelo",
                  "Nutre o couro cabeludo",
                  "Resultados visíveis em 30 dias"
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <Check className="h-5 w-5 text-primary flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                QUERO EXPERIMENTAR <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ========== SEÇÃO 3: AÇÃO 5 EM 1 ========== */}
      <section className="py-16 md:py-24 bg-muted/50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            Ação <span className="text-primary">5 em 1</span>
          </h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            Uma fórmula completa que atua em múltiplas frentes para combater a calvície.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
            {[
              { icon: Zap, title: "Energiza", desc: "Ativa os folículos" },
              { icon: Shield, title: "Protege", desc: "Contra danos externos" },
              { icon: Droplets, title: "Hidrata", desc: "Nutrição profunda" },
              { icon: Clock, title: "Acelera", desc: "Crescimento capilar" },
              { icon: Leaf, title: "Fortalece", desc: "Fios mais resistentes" }
            ].map((item, i) => (
              <div key={i} className="bg-background rounded-xl p-6 text-center shadow-sm">
                <item.icon className="h-10 w-10 text-primary mx-auto mb-3" />
                <h3 className="font-semibold mb-1">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========== SEÇÃO 4: DIFERENCIAIS ========== */}
      <section className="py-16 md:py-24 bg-background">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            Por que escolher o <span className="text-primary">Calvície Zero</span>?
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                emoji: "⚡",
                title: "Super Prático",
                desc: "Use durante o banho como um shampoo normal. Sem complicações."
              },
              {
                emoji: "🎯",
                title: "Resultados Rápidos",
                desc: "Veja a diferença em poucas semanas de uso contínuo."
              },
              {
                emoji: "🌿",
                title: "100% Saudável",
                desc: "Ingredientes naturais sem efeitos colaterais."
              },
              {
                emoji: "💰",
                title: "Custo-Benefício",
                desc: "Muito mais acessível que tratamentos convencionais."
              },
              {
                emoji: "🔬",
                title: "Comprovado",
                desc: "Testado e aprovado por dermatologistas."
              },
              {
                emoji: "📦",
                title: "Entrega Discreta",
                desc: "Embalagem sem identificação do conteúdo."
              }
            ].map((item, i) => (
              <div key={i} className="border border-border rounded-xl p-6 hover:border-primary/50 transition-colors">
                <span className="text-4xl mb-4 block">{item.emoji}</span>
                <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                <p className="text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========== SEÇÃO 5: GRAUS DE CALVÍCIE ========== */}
      <section className="py-16 md:py-24 bg-muted/50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            Identifique seu <span className="text-primary">GRAU DE CALVÍCIE</span>
          </h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            O tratamento é indicado para todos os graus. Quanto antes começar, melhores os resultados.
          </p>

          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* Imagem dos graus */}
            <div className="bg-background rounded-2xl p-8 flex items-center justify-center min-h-[300px] border border-border">
              <div className="text-center text-muted-foreground">
                <div className="flex justify-center gap-4 mb-4">
                  {["I", "II", "III", "IV", "V"].map((g) => (
                    <div key={g} className="w-12 h-12 rounded-full bg-muted flex items-center justify-center font-bold">
                      {g}
                    </div>
                  ))}
                </div>
                <p className="text-sm">Escala de Norwood</p>
                <p className="text-xs opacity-60">(Bloco: Image)</p>
              </div>
            </div>

            {/* Recomendação */}
            <div>
              <h3 className="text-2xl font-bold mb-4">
                Recomendado para todos os estágios
              </h3>
              <p className="text-muted-foreground mb-6">
                Nosso tratamento é eficaz desde os primeiros sinais de afinamento até estágios mais avançados. 
                A fórmula age diretamente nos folículos capilares, estimulando o crescimento de novos fios.
              </p>
              
              <ul className="space-y-3 mb-8">
                {[
                  "Graus I-II: Prevenção e fortalecimento",
                  "Graus III-IV: Recuperação ativa",
                  "Grau V+: Manutenção e suporte"
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <Check className="h-5 w-5 text-primary flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                COMEÇAR TRATAMENTO <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ========== SEÇÃO 6: CTA FINAL ========== */}
      <section className="py-20 md:py-32 bg-gradient-to-br from-primary/10 via-background to-primary/5">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-6">
            Pronto para recuperar sua <span className="text-primary">autoestima</span>?
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            Milhares de homens já recuperaram a confiança com o Calvície Zero. 
            Comece seu tratamento hoje mesmo.
          </p>
          <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground px-10 py-7 text-xl">
            QUERO RECUPERAR MEUS CABELOS <ArrowRight className="ml-2 h-6 w-6" />
          </Button>
          <p className="text-sm text-muted-foreground mt-4">
            Frete grátis • Garantia de 30 dias • Pagamento seguro
          </p>
        </div>
      </section>

      {/* ========== FOOTER INFO (demonstração) ========== */}
      <footer className="py-8 bg-muted/30 border-t border-border">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p className="mb-2">
            <strong>Esta é uma página de demonstração</strong> — mostra como ficaria uma importação estrutural.
          </p>
          <p>
            Cada seção acima corresponde a um grupo de blocos nativos do Builder, 100% editáveis.
          </p>
        </div>
      </footer>
    </div>
  );
}