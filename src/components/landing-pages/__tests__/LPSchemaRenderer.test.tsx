import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LPSchemaRenderer } from "../LPSchemaRenderer";
import type { LPSchema } from "@/lib/landing-page-schema";

const makeMinimalSchema = (premiumTemplateId?: string): LPSchema => ({
  version: "9.0" as any,
  visualStyle: "premium",
  colorScheme: {
    bg: "#070A10",
    bgAlt: "#0B1220",
    text: "#F2F5FF",
    textMuted: "rgba(242,245,255,0.7)",
    accent: "#c9a96e",
    ctaBg: "#c9a96e",
    ctaText: "#0a0a0a",
    cardBg: "rgba(255,255,255,0.04)",
    cardBorder: "rgba(255,255,255,0.08)",
    priceCurrent: "#c9a96e",
    priceOld: "rgba(255,255,255,0.4)",
    badgeBg: "rgba(201,169,110,0.15)",
    badgeText: "#c9a96e",
    shadow: "rgba(0,0,0,0.5)",
    divider: "rgba(255,255,255,0.06)",
    fontDisplay: "'Playfair Display', serif",
    fontBody: "'Inter', sans-serif",
    fontImportUrl: "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&display=swap",
  },
  showHeader: false,
  showFooter: false,
  sections: [
    {
      id: "hero",
      type: "hero",
      props: {
        badge: "TEST",
        title: "Test Product",
        subtitle: "Best product ever",
        benefits: ["Benefit 1", "Benefit 2"],
        ctaText: "Buy Now",
        ctaUrl: "#",
        productImageUrl: "https://example.com/product.png",
      },
    },
    {
      id: "cta_final",
      type: "cta_final",
      props: {
        title: "Don't miss out",
        description: "Get it now",
        ctaText: "Buy Now",
        ctaUrl: "#",
        productImageUrl: "https://example.com/product.png",
      },
    },
  ],
  premiumTemplateId: premiumTemplateId as any,
});

describe("LPSchemaRenderer", () => {
  it("renders without crashing with minimal schema", () => {
    const { container } = render(<LPSchemaRenderer schema={makeMinimalSchema()} />);
    expect(container.querySelector(".w-full.min-h-screen")).toBeTruthy();
  });

  it("renders premium hero when premiumTemplateId is set", () => {
    const { container } = render(
      <LPSchemaRenderer schema={makeMinimalSchema("luxury_editorial")} />
    );
    // Should render the premium hero component
    expect(container.querySelector(".w-full.min-h-screen")).toBeTruthy();
  });

  it("renders all 10 premium template IDs without errors", () => {
    const templateIds = [
      "luxury_editorial", "bold_impact", "minimal_zen", "organic_nature",
      "corporate_trust", "neon_energy", "warm_artisan", "tech_gradient",
      "classic_elegant", "urban_street",
    ];

    for (const id of templateIds) {
      const { container, unmount } = render(
        <LPSchemaRenderer schema={makeMinimalSchema(id)} />
      );
      expect(container.querySelector(".w-full.min-h-screen")).toBeTruthy();
      unmount();
    }
  });

  it("falls back to generic hero when no premiumTemplateId", () => {
    const schema = makeMinimalSchema();
    delete (schema as any).premiumTemplateId;
    const { container } = render(<LPSchemaRenderer schema={schema} />);
    expect(container.querySelector(".w-full.min-h-screen")).toBeTruthy();
  });
});
