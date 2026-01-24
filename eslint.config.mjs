import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";
import boundaries from "eslint-plugin-boundaries";
import tsParser from "@typescript-eslint/parser";

/** @type {import('eslint').LinterpV1.Config[]} */
export default [
  // 1. Base Setup
  {
    files: ["**/*.{js,mjs,cjs,ts}"],
    languageOptions: { 
      globals: globals.node,
      parser: tsParser,
      parserOptions: {
        project: "./tsconfig.json",
        sourceType: "module",
      },
    },
    plugins: {
      "boundaries": boundaries,
    },
    // 2. Define Architecture Boundaries
    settings: {
      "import/resolver": {
        typescript: {
          alwaysTryTypes: true,
          project: ["./tsconfig.json"], // Use an array for safety
        },
        node: {
          extensions: [".js", ".ts", ".tsx"] // Explicitly tell Node resolver about TS
        }
      },
      "boundaries/include": ["src/**/*"],
      "boundaries/elements": [
        // MCP Layer
        {
          type: "mcp-tools",
          pattern: "src/mcp/tools.ts",
          mode: "full",
        },
        {
          type: "mcp-utils",
          pattern: "src/mcp/utils/**/*",
          mode: "full",
        },
        
        // Metadata / Config
        {
          type: "metadata",
          pattern: "src/tools.metadata.ts",
          mode: "full",
        },
        {
          type: "config",
          pattern: "src/env.ts",
          mode: "full",
        },

        // Domain Layer
        {
          type: "domain-service",
          pattern: "src/domain/*/services/**/*",
          mode: "full",
        },
        {
          type: "domain-client",
          pattern: "src/domain/*/clients/**/*",
          mode: "full",
        },
        {
          type: "domain-dto",
          pattern: "src/domain/*/dtos/**/*",
          mode: "full",
        },
        {
          type: "domain-utils",
          pattern: "src/domain/*/utils/**/*",
          mode: "full",
        },

        // Infrastructure Layer
        {
          type: "infra",
          pattern: "src/api/**/*",
          mode: "full",
        },
      ],
    },
    rules: {
      // 3. Enforce Import Rules
      "boundaries/element-types": [
        "error",
        {
          default: "allow", // Allow by default, restrict specific violations below
          rules: [
            // Rule 1: src/mcp/tools.ts Strict Whitelist
            // Can only import: zod (external), mcp-utils, metadata, domain-service
            {
              from: ["mcp-tools"],
              allow: ["mcp-utils", "metadata", "domain-service"],
              disallow: ["domain-client", "domain-dto", "domain-utils", "infra", "config"],
              message: "MCP Tools can only import from Metadata, MCP Utils, and Domain Services.",
            },

            // Rule 2: Domain Layer cannot import from MCP Layer
            {
              from: ["domain-service", "domain-client", "domain-dto", "domain-utils"],
              disallow: ["mcp-tools", "mcp-utils"],
              message: "Domain layer must not depend on the MCP layer (circular dependency risk).",
            },

            // Rule 3: Domain Services cannot use API Infrastructure directly
            // Services must use Domain Clients (repositories/gateways) instead
            {
              from: ["domain-service"],
              disallow: ["infra"],
              message: "Domain Services cannot import Infrastructure (src/api) directly. Use a Domain Client.",
            },
          ],
        },
      ],
      // (Optional) Ensure external imports like 'zod' are allowed generally, 
      // but boundaries plugin focuses on internal project structure.
    },
  },
  
  // Standard recommended configs
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
];