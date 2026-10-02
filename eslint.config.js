import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
  {
    ignores: ["dist", "node_modules", ".next", "build"],
  },
  {
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
    ],

    files: ["**/*.{ts,tsx}"],

    plugins: {
      "react-hooks": reactHooks,
    },

    rules: {
      ...reactHooks.configs.recommended.rules,

      // Qualidade
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-explicit-any": "warn",

      // React
      "react-hooks/exhaustive-deps": "warn",

      // Preferência de estilo
      "prefer-const": "off",
    },
  },
);