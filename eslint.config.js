import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";
import importPlugin from "eslint-plugin-import";

/** @type {import('eslint').Linter.Config[]} */
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
    // We still keep the resolver settings for the import plugin rules
    settings: {
      "import/resolver": {
        typescript: {
          project: "./tsconfig.json",
        },
      },
    },
  },

  // 3. Recommended configs
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,

  // 4. Custom Rules (Naming, unused vars, etc.)
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { 
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_"
      }],
      "@typescript-eslint/naming-convention": ["warn", {
          "selector": "interface",
          "format": ["PascalCase"],
      }]
    }
  },

  // =========================================================
  // 5. ARCHITECTURAL BOUNDARY RULES
  // =========================================================

  // Rule A: Protect the Domain Layer
  // "src/domain" cannot import from "src/mcp"
  {
    files: ["src/domain/**/*.{ts,js}"],
    plugins: {
      import: importPlugin,
    },
    rules: {
      "import/no-restricted-paths": [
        "error",
        {
          zones: [
            {
              target: "./src/domain", 
              from: "./src/mcp",
              message: "Architectural Violation: The Domain Layer cannot import from the MCP Layer."
            }
          ]
        }
      ]
    }
  },

  // Rule B: Protect the Tools Registry
  // "src/mcp/tools.ts" cannot import from "src/api"
  {
    files: ["src/mcp/tools.ts"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          {
            group: [
              "**/api/**"
            ],
            message: "Architectural Violation: tools.ts cannot import directly from src/api. Access functionality via the Domain layer."
          },
          {
            group: [
              "**/domain/**/clients/**", 
              "**/domain/**/utils/**", 
            ],
            message: "Architectural Violation: tools.ts cannot import Domain Services directly. Use Domain Models or other abstractions instead.",
          }
        ]
      }]
    }
  },

  // Rule C: Protect the Domain Services 
  // "src/domain/any-domain/services" cannot directly import from "src/api"
  {
    files: ["src/domain/**/services/*"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          {
            group: [
              "**/api/**"
            ],
            message: "Architectural Violation: domain services cannot import directly from src/api. Access functionality via a Domain client."
          },
        ]
      }]
    }
  },
];