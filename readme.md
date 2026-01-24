# example-mcp-proj-name MCP Server

This is a **Model Context Protocol (MCP)** server that ...

## Features

- **Example_Tool**: Description of tool here.

## 1. Architectural Layers

You must respect the separation of concerns defined in the project structure:

You must respect the separation of concerns defined in the project structure. These boundaries are **strictly enforced via ESLint**:

* **Entry Point (`index.ts`)**: Initializes the server, connects the transport, and handles the main process loop.
* **MCP Layer (`src/mcp/`)**: Handles tool definitions, input validation (Zod), and response formatting.
* `src/mcp/tools.ts`: The registry where tool inputs are mapped to domain functions.
* **Boundary**: Cannot import directly from `src/api`, Domain Clients, or Domain Utils. It must access functionality **only** via Domain Services.

* `src/mcp/utils/`: Helpers for standardizing responses (`toolSuccessResponse`, `toolErrorResponse`) and wrapping functions.

* **Domain Layer (`src/domain/`)**: Contains the business logic and API orchestration.
* **Boundary**: This layer is protected; it **cannot** import from the `src/mcp` layer.
* `src/domain/**/services/`: The main service classes where logic resides.
* **Boundary**: Services cannot import directly from `src/api`. They must access external data via Domain Clients.

* `src/domain/dtos/`: TypeScript interfaces defining the shape of data flowing in and out of the service.

* **Infrastructure Layer (`src/api/`)**:
* `src/api/client.ts`: A wrapper around axios for making HTTP requests to external APIs.

* **Configuration (`src/env.ts`)**:
* Centralized environment variable management. **Never hardcode secrets or URLs; add them here.**

* **Tool Descriptions (`src/tools.metadata.ts`)**:
* Centralized tools text descriptions.

## 2. Installation & Initialization

### Prerequisites
* [Node.js](https://nodejs.org/) (v18 or higher)
* npm
* (auth requirements, tools required to run, etc...)

### Setup Steps

1.  **Install dependencies:**
    ```bash
    npm install
    ```

2.  **Initialize the Project:**
    Run the startup script to rename the project, configure your domain, and set up the initial tool structure. This script effectively "detemplatizes" the code for your specific use case.
    ```bash
    npm run startup-project
    ```
    *Follow the interactive prompts to set your Project Name, Domain Name, Service Method, and Tool Name.*

3.  **Build the project:**
    ```bash
    npm run build
    ```

4.  **Run the project:**
    ```bash
    npm run start
    ```

## 3. Development Workflow

### CLI Generators (Recommended)
This template includes interactive CLI scripts to automate routine tasks and ensure architectural consistency. Run these commands in your terminal and follow the prompts:

* **`npm run new-domain`**
    * Creates a new domain module structure (folders for clients, services, DTOs).
    * Use this when adding a distinct area of functionality (e.g., `weather`, `user-management`).
* **`npm run new-service`**
    * Adds a new business logic service class to an existing domain.
* **`npm run new-client`**
    * Generates an HTTP or Database client wrapper within a domain.
    * Ensures consistent error handling and connection injection.
* **`npm run new-tool`**
    * **Automates the entire "Add a New Tool" process.**
    * It prompts for the domain/service to use, generates the DTOs, injects the method into the Service class, updates `tools.metadata.ts`, and registers the tool in `src/mcp/tools.ts`.

### How to Add a New Tool
To add a new capability to this server, follow this 5-step process to maintain consistency:

1.  **Define Metadata:**
    Add the tool's name and description to `src/tools.metadata.ts`. Use a constant key for the tool name.

2.  **Create DTOs:**
    Define the request parameters and expected response shape in `src/domain/dtos/`.

3.  **Implement Business Logic:**
    * Add a new method to the `DomainService` class in `src/domain/service.ts`.
    * Use the `HttpClient` to make requests.
    * Ensure the method returns a `Promise` of the result DTO or `null` on failure.

4.  **Register Tool & Schema:**
    Update `src/mcp/tools.ts`:
    * Import the metadata and service.
    * Define the `inputSchema` using `zod`.
    * Wrap the service callback using `buildTool(DomainService.yourMethod)`. This wrapper automatically handles success/error JSON formatting.

5.  **Enable the Tool:**
    Add the tool definition to the `TOOLS_ENABLED` array in `src/env.ts`. This allows tools to be toggled via environment variables (e.g., `process.env.EXAMPLE_TOOL === "true"`).

### How to Modify API Client
If authentication or base URLs need changing:
1.  Update `src/env.ts` to parse the new environment variables.
2.  Update `src/domain/utils/api.ts` if custom headers (like API keys) need to be injected dynamically.

## 4. Coding Standards & Conventions

* **Error Handling:**
    * **Domain Layer**: Catch errors, log them, and return `null` or throw manageable errors.
    * **MCP Layer**: Rely on the `newTool` wrapper. It catches exceptions and converts them into the standard `toolErrorResponse` format.
* **Type Safety:**
    * Strictly use TypeScript interfaces/types for all API interactions (`src/domain/dtos/`).
    * Do not use `any` unless absolutely necessary (e.g., inside the generic HTTP client wrapper).
* **Formatting:**
    * Tool output is always a JSON string inside a text block: `content: [{ type: "text", text: JSON.stringify(...) }]`. This is handled by `toolSuccessResponse.ts`.

## Usage

### Auth Steps
Explain how to obtain authentication and configure it to run the mcp tools.

### Configure VS Code

1. **Open the MCP Configuration File**:
* **Global (User-level)**:
* On Windows, press `Win+R`, paste `%APPDATA%\Code\User\mcp.json`, and press Enter.
* Alternatively, in VS Code Copilot Chat, click the tools/attachments icon (at the bottom menu of the prompt input), hover over any MCP server, and click the gear icon.


* **Workspace-level**:
* Create a `.vscode` folder in your project root if it doesn't exist.
* Inside it, create a file named `mcp.json`.
* Add the following json structure to add the config:


```javascript
{
   "settings": {
      // paste the example-mcp-proj-name config here
   }
}
```

2. **Under servers, add**:

```javascript
"example-mcp-proj-name": {
  "command": "node",
  "args": [
    "{yourFullLocalPathToProject}\\{example-mcp-proj-name}\\dist\\index.js"
  ],
  "env": {
    "API_URL": "PLACEHOLDER",
    "EXAMPLE_TOOL": "true",
  }
}
```

> **Note**: Specific note