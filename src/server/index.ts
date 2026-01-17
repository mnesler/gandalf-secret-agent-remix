#!/usr/bin/env bun
/**
 * Organization Documentation MCP Server
 * 
 * An MCP server that exposes your organization's internal documentation
 * and annotated public docs (GCP, Terraform, Tekton) to AI agents.
 * 
 * Supports both MCP Resources (passive context) and Tools (active queries).
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { listResources, readResource, listResourceTemplates } from "./resources.js";
import { listTools, callTool } from "./tools.js";

// Server metadata
const SERVER_NAME = "org-docs";
const SERVER_VERSION = "1.0.0";

/**
 * Create and configure the MCP server
 */
function createServer(): Server {
  const server = new Server(
    {
      name: SERVER_NAME,
      version: SERVER_VERSION,
    },
    {
      capabilities: {
        // Resources: expose docs as readable data
        resources: {
          subscribe: false,
          listChanged: true,
        },
        // Tools: active doc queries
        tools: {
          listChanged: false,
        },
      },
    }
  );

  // ============================================
  // Resource Handlers
  // ============================================

  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: listResources(),
    };
  });

  server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => {
    return {
      resourceTemplates: listResourceTemplates(),
    };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    
    try {
      const contents = await readResource(uri);
      return { contents };
    } catch (error) {
      throw {
        code: -32002,
        message: error instanceof Error ? error.message : "Resource not found",
        data: { uri },
      };
    }
  });

  // ============================================
  // Tool Handlers
  // ============================================

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: listTools(),
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    
    const result = await callTool(name, args || {});
    
    return result;
  });

  return server;
}

/**
 * Main entry point - starts the MCP server
 */
export async function startServer() {
  const server = createServer();
  
  const transport = new StdioServerTransport();
  
  await server.connect(transport);
  
  console.error(`[${SERVER_NAME}] MCP server started (v${SERVER_VERSION})`);
  console.error(`[${SERVER_NAME}] Capabilities: resources, tools`);
  
  process.on("SIGINT", async () => {
    console.error(`[${SERVER_NAME}] Shutting down...`);
    await server.close();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    console.error(`[${SERVER_NAME}] Shutting down...`);
    await server.close();
    process.exit(0);
  });
}

// If running directly (not imported)
if (import.meta.main) {
  startServer().catch((error) => {
    console.error(`[${SERVER_NAME}] Fatal error:`, error);
    process.exit(1);
  });
}
