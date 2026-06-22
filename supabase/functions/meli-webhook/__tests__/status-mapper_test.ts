import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { mapMeliItemToLocal } from "../status-mapper.ts";

Deno.test("active → published", () => {
  const r = mapMeliItemToLocal({ status: "active" }, "publishing");
  assertEquals(r.action, "update");
  assertEquals(r.status, "published");
  assertEquals(r.error_message, null);
});

Deno.test("paused → paused", () => {
  const r = mapMeliItemToLocal({ status: "paused" }, "published");
  assertEquals(r.status, "paused");
  assertEquals(r.error_message, null);
});

Deno.test("under_review → publishing com mensagem", () => {
  const r = mapMeliItemToLocal({ status: "under_review" }, "publishing");
  assertEquals(r.status, "publishing");
  assertEquals(r.error_message, "Em revisão pelo Mercado Livre");
});

Deno.test("inactive (sub paused) → paused", () => {
  const r = mapMeliItemToLocal({ status: "inactive", sub_status: ["paused_manually"] }, "published");
  assertEquals(r.status, "paused");
});

Deno.test("closed + deleted em rascunho nunca publicado → DELETE local", () => {
  const r = mapMeliItemToLocal(
    { status: "closed", sub_status: ["deleted"] },
    "publishing",
  );
  assertEquals(r.action, "delete");
});

Deno.test("closed + deleted em anúncio já publicado → inactive com razão Excluído", () => {
  const r = mapMeliItemToLocal(
    { status: "closed", sub_status: ["deleted"] },
    "published",
  );
  assertEquals(r.action, "update");
  assertEquals(r.status, "inactive");
  assertEquals(r.inactive_reason, "Excluído no Mercado Livre");
});

Deno.test("closed sem sub_status → inactive Finalizado", () => {
  const r = mapMeliItemToLocal({ status: "closed" }, "published");
  assertEquals(r.status, "inactive");
  assertEquals(r.inactive_reason, "Finalizado no Mercado Livre");
});

Deno.test("closed + expired → inactive Expirado", () => {
  const r = mapMeliItemToLocal({ status: "closed", sub_status: ["expired"] }, "published");
  assertEquals(r.status, "inactive");
  assertEquals(r.inactive_reason, "Expirado no Mercado Livre");
});

Deno.test("closed + out_of_stock → inactive Sem estoque", () => {
  const r = mapMeliItemToLocal({ status: "closed", sub_status: ["out_of_stock"] }, "paused");
  assertEquals(r.inactive_reason, "Sem estoque no Mercado Livre");
});

Deno.test("status desconhecido preserva status local", () => {
  const r = mapMeliItemToLocal({ status: "foo_bar" }, "published");
  assertEquals(r.status, "published");
});

Deno.test("sub_status como string única é tratado como array", () => {
  const r = mapMeliItemToLocal({ status: "closed", sub_status: "deleted" as any }, "publishing");
  assertEquals(r.action, "delete");
});
