import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  // ========================================================
  // ANTI-REGRESSION: Proibir URLs hardcoded no Storefront
  // ========================================================
  {
    files: [
      "src/pages/storefront/**/*.{ts,tsx}",
      "src/components/storefront/**/*.{ts,tsx}",
    ],
    rules: {
      // Proibir strings literais contendo "/store/" em navegação pública
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/\\/store\\//]",
          message: "❌ URL hardcoded detectada! Use useStorefrontUrls() ou publicUrls helpers. Nunca monte rotas com '/store/' no storefront.",
        },
        {
          selector: "TemplateLiteral[quasis.0.value.raw=/\\/store\\//]",
          message: "❌ Template string com '/store/' detectado! Use useStorefrontUrls() ou publicUrls helpers.",
        },
        {
          selector: "TemplateLiteral[quasis.0.value.raw=/tenantSlug/]",
          message: "❌ tenantSlug em template string detectado! Use useStorefrontUrls() para gerar URLs domain-aware.",
        },
      ],
    },
  },
);
