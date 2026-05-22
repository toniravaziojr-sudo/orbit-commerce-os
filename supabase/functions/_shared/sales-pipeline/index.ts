// Barrel export — pipeline F2.
export * from "./states.ts";
export * from "./tool-filter.ts";
export * from "./transitions.ts";
export * from "./prompt-router.ts";
export * from "./variant-gate.ts";
export * from "./product-resolver.ts";
export * from "./greeting-mirror.ts";
export * from "./search-products-shape.ts";
// [Reg #2] Blocos 3.3, 3.4, 3.6
export * from "./greeting-scrub.ts";
export * from "./intent-fingerprint.ts";
export * from "./consultative-turn.ts";
// [Reg #2.8] Turn Pre-Router + Catalog Probe + Output Gates
export * from "./turn-pre-router.ts";
export * from "./catalog-probe.ts";
export * from "./output-gates.ts";
// [Reg #2.9] Onda 2 — Working Memory + Stage Machine
export * from "./working-memory.ts";
export * from "./stage-machine.ts";
// [Reg #2.9] Onda 3 — Working Memory Prompt Block
export * from "./working-memory-prompt.ts";
// [Onda 18 — Fase B] Policy Compiler — fonte central da política efetiva
export * from "./policy-compiler.ts";
// [Reg #2.13] Fase C — Turn Orchestrator
export * from "./turn-completeness.ts";
export * from "./turn-orchestrator.ts";
// [Reg #19] Marketplace scrub — strip de links/telefones/emails em canais
// onde a IA não pode direcionar o cliente para fora da plataforma.
export * from "./marketplace-scrub.ts";
// [Reg #2.17 — Fase 1] Detector determinístico: dor física vs reclamação de pedido
export * from "./pain-symptom-detector.ts";
// [Reg #2.17 — Fase 2] Motor único de decisão de handoff
export * from "./handoff-motor.ts";
