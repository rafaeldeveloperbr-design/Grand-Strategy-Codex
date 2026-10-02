import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
  { ignores: ["dist", "node_modules", ".next", "build"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": "off", // desliga essa chatice por enquanto
      "prefer-const": "off", // desliga essa chatice por enquanto
      "react-hooks/exhaustive-deps": "warn", // desliga a dependência de hook que tá te dando 2 warnings
      "@typescript-eslint/no-explicit-any": "warn",

    },
  },
);
