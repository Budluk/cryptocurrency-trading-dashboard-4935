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
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "@typescript-eslint/no-unused-vars": "off",
      // Dívida legada: `any` aparece em respostas dinâmicas de Supabase/Bybit.
      // Continua visível como aviso; nos módulos novos abaixo é erro.
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  {
    // Módulos escritos neste branch não usam `any`: manter barreira rígida.
    files: [
      "src/config/riskLimits.ts",
      "src/hooks/useSignalGateway.ts",
      "src/hooks/useTradingCalculations.tsx",
      "supabase/functions/_shared/agentLoop.ts",
      "supabase/functions/_shared/autonomousAgent.ts",
      "supabase/functions/_shared/autonomousPrompt.ts",
      "supabase/functions/_shared/autonomousRisk.ts",
      "supabase/functions/_shared/indicators.ts",
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  {
    // Código Deno lida com JSON externo dinâmico: `any` é explícito e aceito
    // aqui.
    files: ["supabase/functions/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    // Config do Tailwind é CommonJS por design do loadConfig.
    files: ["tailwind.config.ts"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  }
);
