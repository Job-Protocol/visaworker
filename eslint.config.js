import js from "@eslint/js";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", ".output", ".vinxi"] },
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
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "server-only",
              message:
                "TanStack Start does not use the Next.js `server-only` package. Rename the module to `*.server.ts` or mark it with `@tanstack/react-start/server-only`.",
            },
          ],
          patterns: [
            {
              group: [
                "@/ee/*",
                "src/ee/*",
                "../ee/*",
                "../../ee/*",
                "!@/ee/server",
              ],
              message:
                "Deep imports into `src/ee/` are banned — the open build swaps `@/ee` for a stub. Import from a barrel: `@/ee` (client-safe) or `@/ee/server` (server-only).",
            },
          ],
        },
      ],

      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      // Pragmatic: `any` is used deliberately at a number of boundaries
      // (JWT claims, third-party payloads). Not worth failing CI over.
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  eslintPluginPrettier,
  // Keep eslint-config-prettier's rule-disabling, but do NOT enforce formatting
  // as lint errors — Prettier-via-ESLint fights the connected editor's formatter
  // and would fail CI on cosmetic diffs. Run `bun run format` to tidy manually.
  { rules: { "prettier/prettier": "off" } },
);
