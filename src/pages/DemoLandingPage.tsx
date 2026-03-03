// =============================================
// DEMO LANDING PAGE - Página de comparação gerada pelo Lovable Editor
// Produto: Shampoo Calvície Zero (Respeite o Homem)
// Objetivo: Comparar com as versões geradas via Edge Function e HTML direto
// =============================================

import { Helmet } from "react-helmet-async";

const PRODUCT = {
  name: "Shampoo Calvície Zero",
  price: "93,01",
  comparePrice: "97,90",
  kit2Price: "159,95",
  kit3Price: "228,77",
  kit6Price: "396,18",
  image: "https://cdn.shopify.com/s/files/1/0625/7269/1550/files/thumbs_novas_oficiais.png?v=1756180457",
  image2: "https://cdn.shopify.com/s/files/1/0625/7269/1550/files/2.webp?v=1765205742",
  image3: "https://cdn.shopify.com/s/files/1/0625/7269/1550/files/3.png?v=1765205742",
};

const REVIEWS = [
  { name: "Marcos", title: "Realmente funciona!", text: "Estava cético no início, mas o Shampoo Calvície Zero superou minhas expectativas. Em algumas semanas, a queda diminuiu drasticamente e já noto fios novos." },
  { name: "Rodrigo", title: "Meu cabelo está voltando!", text: "As falhas estão diminuindo e meu cabelo está engrossando. O cheiro é agradável e não irrita o couro cabeludo. Valeu cada centavo." },
  { name: "Ricardo", title: "Finalmente um que cumpre", text: "Já gastei fortunas em outros shampoos, mas só o Calvície Zero entregou resultados. Ação 5 em 1 é real." },
  { name: "Fernando", title: "Qualidade excelente", text: "Produto de altíssima qualidade. Uso há um mês e já vejo bons resultados. O controle da oleosidade é um ponto positivo." },
  { name: "André", title: "Excelente!", text: "Meu cabelo estava muito fino e ralo. Agora está mais encorpado e com volume. A melhora na aparência é notável." },
  { name: "Carlos", title: "Força e brilho", text: "Meu cabelo estava opaco e fraco, agora está com mais brilho e força. A caspa também sumiu. Produto completo." },
];

const BENEFITS = [
  { icon: "🛡️", title: "Interrompe 99% da Queda", desc: "Redução visível da queda irregular em apenas 7 a 15 dias de uso contínuo." },
  { icon: "🧬", title: "Bloqueia o DHT", desc: "Neutraliza o hormônio responsável pela calvície masculina diretamente no couro cabeludo." },
  { icon: "🚀", title: "Acelera o Crescimento", desc: "Baicapil, Cafeína e Biotina aceleram o crescimento dos fios em até 35%." },
  { icon: "💪", title: "Recupera o Volume", desc: "Fios mais grossos e encorpados, preenchendo as falhas de forma gradual e natural." },
  { icon: "✨", title: "Fortalece da Raiz", desc: "Colágeno Hidrolisado e Pantenol fortalecem os fios da raiz às pontas." },
  { icon: "🧴", title: "Limpeza Profunda", desc: "Previne caspa, controla oleosidade e proporciona brilho natural aos fios." },
];

const INGREDIENTS = ["Biotina", "Colágeno Hidrolisado", "Climbazol", "Cafeína", "Baicapil", "Pantenol", "Capillmax", "Alecrim", "Mentol"];

const FAQ = [
  { q: "Em quanto tempo vejo resultados?", a: "A maioria dos clientes nota redução significativa da queda entre 7 e 15 dias. O crescimento de novos fios é gradual e varia conforme o grau de calvície." },
  { q: "Quanto tempo dura um frasco?", a: "Cada frasco de 250ml dura aproximadamente 2 meses de uso regular." },
  { q: "Funciona para todos os graus de calvície?", a: "O shampoo é indicado para queda, falhas e cabelo ralo. Para graus avançados, recomendamos contato via WhatsApp para orientação personalizada." },
  { q: "Pode usar na barba?", a: "Sim! O Shampoo Calvície Zero também pode ser usado na barba para fortalecer e estimular o crescimento dos fios." },
  { q: "Tem registro na ANVISA?", a: "Sim. O produto possui registro ANVISA, garantindo segurança e eficácia comprovadas." },
];

export default function DemoLandingPage() {
  return (
    <>
      <Helmet>
        <title>Shampoo Calvície Zero | Respeite o Homem — Demo LP</title>
        <meta name="description" content="Landing page demo gerada pelo Lovable Editor para comparação." />
        <link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </Helmet>

      <div className="min-h-screen" style={{ fontFamily: "'Inter', system-ui, sans-serif", color: "#1a1a2e" }}>
        
        {/* ══════════ HERO ══════════ */}
        <section
          className="relative overflow-hidden text-center"
          style={{
            background: "linear-gradient(135deg, #0a0a1a 0%, #141432 40%, #1e1245 70%, #2d1b4e 100%)",
            padding: "clamp(60px, 10vw, 120px) 24px clamp(80px, 12vw, 140px)",
          }}
        >
          {/* Glow effect */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: "radial-gradient(ellipse 60% 50% at 50% 80%, rgba(255,193,7,0.08), transparent)",
            }}
          />

          <div className="relative z-10 max-w-[820px] mx-auto">
            <span
              className="inline-block mb-6 text-xs font-bold tracking-[2px] uppercase"
              style={{
                background: "rgba(255,193,7,0.12)",
                color: "#ffc107",
                padding: "8px 20px",
                borderRadius: "50px",
                border: "1px solid rgba(255,193,7,0.2)",
              }}
            >
              Tratamento Anticalvície #1 do Brasil
            </span>

            <h1
              className="mb-5"
              style={{
                fontFamily: "'Sora', sans-serif",
                fontSize: "clamp(2rem, 5.5vw, 3.5rem)",
                fontWeight: 800,
                color: "#fff",
                lineHeight: 1.1,
                letterSpacing: "-0.02em",
              }}
            >
              Interrompa até{" "}
              <span
                style={{
                  background: "linear-gradient(135deg, #ffc107, #ff9800)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                99% da queda
              </span>{" "}
              em apenas 15 dias
            </h1>

            <p className="mb-8 mx-auto max-w-[600px]" style={{ fontSize: "1.1rem", color: "rgba(255,255,255,0.7)", lineHeight: 1.75 }}>
              Fórmula exclusiva com nanotecnologia de óleos asiáticos. Ação 5 em 1 que bloqueia DHT, estimula crescimento e recupera fios fortes e volumosos.
            </p>

            <div className="flex flex-wrap justify-center gap-4 mb-10">
              <a
                href="#ofertas"
                className="inline-flex items-center gap-2 font-bold text-base no-underline transition-transform hover:scale-105"
                style={{
                  background: "linear-gradient(135deg, #ffc107, #ff9800)",
                  color: "#1a1a2e",
                  padding: "18px 40px",
                  borderRadius: "14px",
                  boxShadow: "0 8px 40px rgba(255,193,7,0.3), 0 2px 8px rgba(0,0,0,0.2)",
                }}
              >
                QUERO ACABAR COM A CALVÍCIE →
              </a>
            </div>

            <div className="flex flex-wrap justify-center gap-6 text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>
              {["Frete Grátis*", "Registro ANVISA", "Satisfação Garantida"].map((t) => (
                <span key={t} className="flex items-center gap-2">
                  <span style={{ color: "#ffc107" }}>✓</span> {t}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════ TRUST BAR ══════════ */}
        <section style={{ background: "#111127", padding: "0" }}>
          <div
            className="max-w-[1000px] mx-auto grid grid-cols-2 md:grid-cols-4 gap-0"
            style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
          >
            {[
              { val: "99%", label: "Redução da queda" },
              { val: "+35%", label: "Crescimento dos fios" },
              { val: "5 em 1", label: "Ação completa" },
              { val: "250ml", label: "Dura 2 meses" },
            ].map((item, i) => (
              <div
                key={i}
                className="text-center py-8"
                style={{ borderRight: i < 3 ? "1px solid rgba(255,255,255,0.06)" : "none" }}
              >
                <div style={{ fontFamily: "'Sora'", fontSize: "1.8rem", fontWeight: 800, color: "#ffc107" }}>{item.val}</div>
                <div className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.45)" }}>{item.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ══════════ PRODUTO + OFERTA ══════════ */}
        <section id="ofertas" className="py-20 px-6" style={{ background: "#fff" }}>
          <div className="max-w-[1100px] mx-auto grid md:grid-cols-2 gap-16 items-center">
            <div className="relative">
              <div
                className="absolute -inset-4 rounded-3xl -z-10"
                style={{ background: "linear-gradient(135deg, rgba(255,193,7,0.08), rgba(255,152,0,0.05))" }}
              />
              <img
                src={PRODUCT.image}
                alt="Shampoo Calvície Zero"
                className="w-full h-auto rounded-2xl"
                style={{ boxShadow: "0 24px 80px rgba(0,0,0,0.1)" }}
              />
              <div className="flex gap-3 mt-4">
                <img src={PRODUCT.image2} alt="" className="w-20 h-20 rounded-lg object-cover border-2 border-transparent hover:border-amber-400 cursor-pointer transition-colors" />
                <img src={PRODUCT.image3} alt="" className="w-20 h-20 rounded-lg object-cover border-2 border-transparent hover:border-amber-400 cursor-pointer transition-colors" />
              </div>
            </div>

            <div>
              <span
                className="inline-block text-xs font-bold px-3 py-1 rounded-md mb-4"
                style={{ background: "#e8f5e9", color: "#2e7d32" }}
              >
                ⭐ MAIS VENDIDO
              </span>
              <h2 style={{ fontFamily: "'Sora'", fontSize: "2rem", fontWeight: 800, margin: "0 0 8px" }}>
                {PRODUCT.name}
              </h2>
              <p className="text-sm mb-6" style={{ color: "#888" }}>
                Frasco 250ml — Até 2 meses de uso · Ação 5 em 1 · Com Biotina, Colágeno, Cafeína e Baicapil
              </p>

              {/* Pricing card */}
              <div className="rounded-2xl p-6 mb-6" style={{ background: "#f8f9fa", border: "1px solid #eee" }}>
                <div className="flex items-baseline gap-3 mb-1">
                  <span className="text-sm line-through" style={{ color: "#bbb" }}>R$ {PRODUCT.comparePrice}</span>
                  <span style={{ fontFamily: "'Sora'", fontSize: "2.2rem", fontWeight: 800, color: "#2e7d32" }}>
                    R$ {PRODUCT.price}
                  </span>
                </div>
                <span className="text-xs" style={{ color: "#888" }}>em até 12x no cartão · Pix com desconto</span>
              </div>

              <a
                href="#"
                className="block text-center font-bold text-base no-underline mb-4 transition-transform hover:scale-[1.02]"
                style={{
                  background: "linear-gradient(135deg, #ffc107, #ff9800)",
                  color: "#1a1a2e",
                  padding: "18px",
                  borderRadius: "14px",
                  boxShadow: "0 6px 24px rgba(255,193,7,0.25)",
                }}
              >
                COMPRAR 1 UNIDADE — R$ {PRODUCT.price}
              </a>

              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Kit 2x", price: PRODUCT.kit2Price, save: "Economize 18%" },
                  { label: "Kit 3x", price: PRODUCT.kit3Price, save: "Economize 27%" },
                  { label: "Kit 6x", price: PRODUCT.kit6Price, save: "Economize 29%" },
                ].map((kit) => (
                  <a
                    key={kit.label}
                    href="#"
                    className="block text-center no-underline rounded-xl py-3 px-2 transition-colors hover:bg-[#2a2a4e]"
                    style={{ background: "#1a1a2e", color: "#fff", border: "1px solid #2a2a4e" }}
                  >
                    <span className="block text-xs font-bold" style={{ color: "#ffc107" }}>{kit.save}</span>
                    <span className="block text-sm font-semibold mt-1">{kit.label}</span>
                    <span className="block text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.6)" }}>R$ {kit.price}</span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ══════════ BENEFÍCIOS ══════════ */}
        <section className="py-20 px-6" style={{ background: "#f8f9fb" }}>
          <div className="max-w-[1000px] mx-auto">
            <div className="text-center mb-14">
              <h2 style={{ fontFamily: "'Sora'", fontSize: "2rem", fontWeight: 800, margin: "0 0 12px" }}>
                Ação 5 em 1 contra a calvície
              </h2>
              <p style={{ color: "#888", fontSize: "1.05rem" }}>Cada lavagem é um passo rumo ao cabelo que você merecia ter.</p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {BENEFITS.map((b) => (
                <div
                  key={b.title}
                  className="rounded-2xl p-7 transition-shadow hover:shadow-lg"
                  style={{
                    background: "#fff",
                    border: "1px solid #f0f0f0",
                    boxShadow: "0 2px 12px rgba(0,0,0,0.03)",
                  }}
                >
                  <span className="text-2xl block mb-3">{b.icon}</span>
                  <h3 className="text-sm font-bold mb-2" style={{ fontFamily: "'Sora'", color: "#1a1a2e" }}>{b.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: "#777", margin: 0 }}>{b.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════ DEPOIMENTOS ══════════ */}
        <section className="py-20 px-6" style={{ background: "#fff" }}>
          <div className="max-w-[1000px] mx-auto">
            <div className="text-center mb-14">
              <h2 style={{ fontFamily: "'Sora'", fontSize: "2rem", fontWeight: 800, margin: "0 0 8px" }}>
                +10.000 homens já transformaram seus cabelos
              </h2>
              <p style={{ color: "#888", fontSize: "1rem" }}>Avaliações reais e verificadas</p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {REVIEWS.map((r) => (
                <div
                  key={r.name}
                  className="rounded-2xl p-6"
                  style={{
                    background: "#fafafa",
                    border: "1px solid #f0f0f0",
                  }}
                >
                  <div className="text-amber-400 text-base mb-2">★★★★★</div>
                  <h4 className="text-sm font-bold mb-2" style={{ color: "#1a1a2e" }}>{r.title}</h4>
                  <p className="text-sm leading-relaxed mb-3" style={{ color: "#777", margin: 0 }}>"{r.text}"</p>
                  <span className="text-xs font-semibold" style={{ color: "#bbb" }}>— {r.name}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════ COMPOSIÇÃO ══════════ */}
        <section className="py-20 px-6" style={{ background: "#f8f9fb" }}>
          <div className="max-w-[800px] mx-auto text-center">
            <h2 style={{ fontFamily: "'Sora'", fontSize: "1.8rem", fontWeight: 800, margin: "0 0 12px" }}>
              Fórmula Exclusiva com Nanotecnologia
            </h2>
            <p className="mb-10" style={{ color: "#888", fontSize: "1rem", lineHeight: 1.7 }}>
              Ativo exclusivo de nanotecnologia de óleos vegetais importados da Ásia, 100% naturais, combinado com os melhores ativos do mercado.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {INGREDIENTS.map((ing) => (
                <span
                  key={ing}
                  className="text-sm font-semibold px-5 py-2.5 rounded-full"
                  style={{
                    background: "#fff",
                    color: "#1a1a2e",
                    border: "1px solid #e8e8e8",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                  }}
                >
                  {ing}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════ FAQ ══════════ */}
        <section className="py-20 px-6" style={{ background: "#fff" }}>
          <div className="max-w-[700px] mx-auto">
            <h2 className="text-center mb-12" style={{ fontFamily: "'Sora'", fontSize: "1.8rem", fontWeight: 800 }}>
              Perguntas Frequentes
            </h2>
            <div className="space-y-4">
              {FAQ.map((item) => (
                <div
                  key={item.q}
                  className="rounded-xl p-6"
                  style={{ background: "#f8f9fb", border: "1px solid #f0f0f0" }}
                >
                  <h3 className="text-sm font-bold mb-2" style={{ color: "#1a1a2e" }}>{item.q}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: "#777", margin: 0 }}>{item.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════ CTA FINAL ══════════ */}
        <section
          className="text-center"
          style={{
            background: "linear-gradient(135deg, #0a0a1a, #1e1245, #2d1b4e)",
            padding: "clamp(60px, 10vw, 100px) 24px",
          }}
        >
          <div className="max-w-[650px] mx-auto">
            <h2
              style={{
                fontFamily: "'Sora'",
                fontSize: "clamp(1.5rem, 4vw, 2.4rem)",
                fontWeight: 800,
                color: "#fff",
                lineHeight: 1.2,
                margin: "0 0 16px",
              }}
            >
              Pare de perder cabelo.
              <br />
              <span style={{ color: "#ffc107" }}>Comece a recuperar.</span>
            </h2>
            <p className="mb-10" style={{ color: "rgba(255,255,255,0.6)", fontSize: "1.05rem", lineHeight: 1.7 }}>
              Milhares de homens já recuperaram a confiança. Escolha o seu kit e comece hoje.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <a
                href="#ofertas"
                className="font-bold no-underline transition-transform hover:scale-105"
                style={{
                  background: "linear-gradient(135deg, #ffc107, #ff9800)",
                  color: "#1a1a2e",
                  padding: "18px 36px",
                  borderRadius: "14px",
                  fontSize: "1rem",
                  boxShadow: "0 8px 40px rgba(255,193,7,0.3)",
                }}
              >
                QUERO COMPRAR AGORA
              </a>
            </div>
          </div>
        </section>

        {/* ══════════ FOOTER MINI ══════════ */}
        <footer className="text-center py-6 text-xs" style={{ background: "#0a0a1a", color: "rgba(255,255,255,0.3)" }}>
          Demo LP — Gerada pelo Lovable Editor para fins de comparação · Dados reais do catálogo Respeite o Homem
        </footer>
      </div>
    </>
  );
}
