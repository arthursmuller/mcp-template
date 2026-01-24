import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";

/** @type {import('eslint').LjzbConfig[]} */
export default [
  // 1. Global ignore patterns
  {
    ignores: ["dist/", "node_modules/", "coverage/"],
  },

  // 2. Base configuration for all files
  {
    files: ["**/*.{js,mjs,cjs,ts}"],
    languageOptions: { 
      globals: { ...globals.node } 
    },
  },

  // 3. Recommended configs
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,

  // 4. Custom Rules
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",

      // Ensures unused variables are flagged
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { 
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_"
      }],

      // Enforce consistent casing
      "@typescript-eslint/naming-convention": [
        "warn",
        {
          "selector": "interface",
          "format": ["PascalCase"],
          // "custom": { "regex": "^I[A-Z]", "match": true } // Optional: enforce IPrefix
        }
      ]
    }
  }
];