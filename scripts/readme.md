# Project Scaffolding & Automation Scripts

This directory contains a suite of interactive CLI tools designed to automate the development lifecycle of the MCP Server. These scripts are critical for maintaining the **Strict Layered Architecture** (MCP Layer -> Domain Layer -> Infrastructure Layer) by enforcing naming conventions and generating boilerplate code.

## 🚀 Getting Started

Run scripts using `npm run <script-name>`. You do not need to execute TypeScript files directly.

## 1. Initialization Script

### `npm run scaffold:startup`

**File:** [`scripts/startup-project/script.ts`](https://www.google.com/search?q=scripts/startup-project/script.ts)

**Purpose:** "De-templatizes" the repository. This is a one-time setup script that renames the project and creates your first actual domain.

* **Inputs:**
1. **Project Name**: Updates `package.json` and `readme.md`.
2. **Domain Name**: Renames the default `src/domain/domain-name` folder.
3. **Service/Tool Names**: Configures the initial example tool code.


* **What it does:**
* Renames directories and files to match your domain (e.g., `domain.service.ts` → `weather.service.ts`).
* Updates `src/env.ts` with correct server names and tool flags.
* Updates `src/mcp/tools.ts` imports to match the new structure.
* **Self-Destruct**: Deletes itself and the `startup-project` command from `package.json` after successful execution.



## 2. Feature Generators

### `npm run scaffold:tool`

**File:** [`scripts/scaffold-tool/script.ts`](https://www.google.com/search?q=scripts/scaffold-tool/script.ts)

**Purpose:** The primary workflow for exposing new functionality. It orchestrates changes across all architectural layers to turn a Domain Service method into an MCP Tool.

* **Inputs:**
* Selects an existing Domain & Service.
* Prompts for a new method name (e.g., `getForecast`) and Tool name (e.g., `get_forecast`).
* Optionally allows linking/creating HTTP or Database clients.


* **Modifications:**
1. **Metadata**: Adds name/description to `src/tools.metadata.ts`.
2. **Config**: Adds a toggle flag to `TOOLS_ENABLED` in `src/env.ts`.
3. **DTOs**: Generates request/response interfaces in `src/domain/<domain>/dtos/`.
4. **Domain**: Injects a stub method into the selected Service class.
5. **Infrastructure**: Optionally injects methods into selected Client classes.
6. **MCP Layer**: Registers the tool in `src/mcp/tools.ts` with a Zod schema placeholder and `buildTool` callback wrapper.



### `npm run scaffold:domain`

**File:** [`scripts/scaffold-domain/script.ts`](https://www.google.com/search?q=scripts/scaffold-domain/script.ts)

**Purpose:** establishes a new modular boundary. Use this when adding a distinct set of capabilities (e.g., adding "Billing" to a "Weather" app).

* **Inputs:** Domain name, toggle for HTTP/DB clients.
* **Outputs:**
* Creates directory: `src/domain/<name>/`.
* Scaffolds subdirectories: `clients/`, `services/`, `dtos/`, `utils/`.
* Generates a default Service class with dependency injection for selected clients.
* Generates `utils/api.ts` (if HTTP is selected) for centralized header management.



### `npm run scaffold:service`

**File:** [`scripts/scaffold-service/script.ts`](https://www.google.com/search?q=scripts/scaffold-service/script.ts)

**Purpose:** Expands an existing domain with new business logic.

* **Inputs:** Selects a domain, names the service, and configures dependencies.
* **Dependency Injection:** You can choose to:
* Use **Existing** Clients (lists available files).
* Create **New** Clients (generates file and injects).
* **None** (pure logic service).


* **Outputs:** Generates a `*.service.ts` file exporting an instantiated singleton (e.g., `export default new MyService(...)`).

### `npm run scaffold:client`

**File:** [`scripts/scaffold-client/script.ts`](https://www.google.com/search?q=scripts/scaffold-client/script.ts)

**Purpose:** Adds infrastructure connectors to a domain.

* **Inputs:** Domain selection, Client Type (HTTP vs Database).
* **Outputs:**
* **HTTP**: Generates a class wrapping `src/api/client.ts`. automatically creates `utils/api.ts` if missing.
* **DB**: Generates a class stub for database queries.



## Internal Utilities

### `utils.ts`

**File:** [`scripts/utils.ts`](https://www.google.com/search?q=scripts/utils.ts)

Contains shared logic used by all scripts to ensure consistency:

* **Text Casing**: Enforces specific formats:
* `kebab-case` for file and directory names.
* `PascalCase` for Class and Interface names.
* `camelCase` for method names.


* **Filesystem**: Helpers to map domain directories to their contained services.
* **CLI**: Wrapper around `readline` for handling user prompts.

## Testing

The scripts folder includes its own test suite to ensure the generators produce valid code and respect file system operations.

* **`tests/mocks/`**: Contains mocks for `utils.ts` and file system operations.
* **`tests/utils/file-system.ts`**: Implements a Virtual File System (MockFileSystem) to test file creation/updates in memory without writing to disk.

Run script tests with:

```bash
npm run test:scaffold
```