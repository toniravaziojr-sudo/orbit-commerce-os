import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  mapGender,
  mapGeoLocations,
  applyPlacements,
  mapAttributionSpec,
  findAudienceByName,
  extractIncludedAudienceRefs,
} from "../meta-publish-mappers.ts";

Deno.test("mapGender — PT-BR e inglês", () => {
  assertEquals(mapGender("Masculino"), [1]);
  assertEquals(mapGender("masculino"), [1]);
  assertEquals(mapGender("homem"), [1]);
  assertEquals(mapGender("Feminino"), [2]);
  assertEquals(mapGender("female"), [2]);
  assertEquals(mapGender("Todos"), undefined);
  assertEquals(mapGender(""), undefined);
  assertEquals(mapGender([1, 2]), [1, 2]);
  assertEquals(mapGender(null), undefined);
});

Deno.test("mapGeoLocations — fallback BR", () => {
  assertEquals(mapGeoLocations({}), { countries: ["BR"] });
  assertEquals(mapGeoLocations({ location: "br" }), { countries: ["BR"] });
  assertEquals(
    mapGeoLocations({ geo_locations: { countries: ["US"], cities: [{ key: "x" }] } }),
    { countries: ["US"], cities: [{ key: "x" }] },
  );
});

Deno.test("applyPlacements — Advantage+ omite publisher_platforms", () => {
  const t: any = {};
  applyPlacements(t, { placements: ["advantage_plus"] });
  assertEquals(t.targeting_automation, { advantage_audience: 1 });
  assertEquals(t.publisher_platforms, undefined);
});

Deno.test("applyPlacements — lista manual mapeia para posicionamentos", () => {
  const t: any = {};
  applyPlacements(t, { placements: ["facebook_feed", "instagram_reels", "instagram_stories"] });
  assert(t.publisher_platforms.includes("facebook"));
  assert(t.publisher_platforms.includes("instagram"));
  assertEquals(t.facebook_positions, ["feed"]);
  assertEquals(t.instagram_positions.sort(), ["reels", "story"].sort());
});

Deno.test("applyPlacements — vazio não polui targeting", () => {
  const t: any = {};
  applyPlacements(t, {});
  assertEquals(t.publisher_platforms, undefined);
  assertEquals(t.targeting_automation, undefined);
});

Deno.test("mapAttributionSpec — 7d clique + 1d view", () => {
  const spec = mapAttributionSpec("7d_click_1d_view");
  assertEquals(spec, [
    { event_type: "CLICK_THROUGH", window_days: 7 },
    { event_type: "VIEW_THROUGH", window_days: 1 },
  ]);
  assertEquals(mapAttributionSpec("1d_click"), [{ event_type: "CLICK_THROUGH", window_days: 1 }]);
  assertEquals(mapAttributionSpec(""), undefined);
});

Deno.test("findAudienceByName — exato, sem acento, contém", () => {
  const cat = [
    { id: "1", name: "LAL 1% Compradores 180D" },
    { id: "2", name: "Clientes - Atualizado 14/06/2026" },
  ];
  assertEquals(findAudienceByName(cat, "LAL 1% Compradores 180D")?.id, "1");
  assertEquals(findAudienceByName(cat, "lal 1% compradores 180d")?.id, "1");
  assertEquals(findAudienceByName(cat, "Clientes")?.id, "2");
  assertEquals(findAudienceByName(cat, "Nada disso"), null);
});

Deno.test("extractIncludedAudienceRefs — formatos múltiplos", () => {
  const refs = extractIncludedAudienceRefs({
    targeting: { custom_audiences: [{ id: "111" }] },
    required_lookalikes: ["Lookalike 1% Compra 180D"],
    required_audiences: [{ name: "Carrinho 30D" }],
    included_audience_ids: ["222333444555"],
  });
  assertEquals(refs.length, 4);
  assertEquals(refs[0], { id: "111" });
  assertEquals(refs[1].name, "Lookalike 1% Compra 180D");
  assertEquals(refs[2].name, "Carrinho 30D");
  assertEquals(refs[3], { id: "222333444555" });
});
