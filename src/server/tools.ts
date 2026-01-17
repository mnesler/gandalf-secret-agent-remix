/**
 * MCP Tools implementation.
 * Exposes tools for querying organization documentation.
 */

import type { CallToolResult, Tool } from "@modelcontextprotocol/sdk/types.js";
import { DOC_SOURCES, getDocConfig, getAllTopics } from "./config/doc-sources.js";
import { fetchDoc } from "./sources/index.js";
import { searchDocs } from "./search.js";

/**
 * Get all tool definitions.
 */
export function listTools(): Tool[] {
  return [
    {
      name: "list_topics",
      description: 
        "List all available documentation topics. " +
        "Call this first to discover what documentation is available. " +
        "Returns both internal standards and public reference docs.",
      inputSchema: {
        type: "object",
        properties: {},
        required: [],
      },
    },
    {
      name: "get_doc",
      description:
        "Retrieve the full content of a documentation topic by name. " +
        "Use after calling list_topics to get a specific document. " +
        "Returns the complete documentation in markdown format.",
      inputSchema: {
        type: "object",
        properties: {
          topic: {
            type: "string",
            description:
              "Topic name from list_topics (e.g., 'naming-standards', 'security-policies', 'gcp-storage-bucket')",
          },
        },
        required: ["topic"],
      },
    },
    {
      name: "search_docs",
      description:
        "Search across all documentation for relevant content. " +
        "Returns matching excerpts with relevance scores. " +
        "Use when you need to find specific information without knowing the exact topic.",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "Search query (e.g., 'GCS bucket labels', 'service account naming', 'terraform module')",
          },
          limit: {
            type: "number",
            description: "Maximum number of results to return (default: 5, max: 20)",
            default: 5,
          },
        },
        required: ["query"],
      },
    },
  ];
}

/**
 * Execute a tool call.
 */
export async function callTool(
  name: string,
  args: Record<string, unknown>
): Promise<CallToolResult> {
  try {
    switch (name) {
      case "list_topics":
        return listTopics();
      case "get_doc":
        return await getDoc(args.topic as string);
      case "search_docs":
        return await searchDocsHandler(
          args.query as string,
          (args.limit as number) || 5
        );
      default:
        return {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error executing ${name}: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * List all available documentation topics.
 */
function listTopics(): CallToolResult {
  const internal = DOC_SOURCES.filter((d) => d.category === "internal");
  const publicDocs = DOC_SOURCES.filter((d) => d.category === "public");

  const output = `# Available Documentation

## Internal Standards (Organization-specific)
${internal.map((d) => `- **${d.topic}**: ${d.description}`).join("\n")}

## Public Reference Documentation
${publicDocs.map((d) => `- **${d.topic}**: ${d.description}`).join("\n")}

---
Use \`get_doc\` with a topic name to retrieve full documentation.
Use \`search_docs\` to search across all documentation.`;

  return {
    content: [{ type: "text", text: output }],
  };
}

/**
 * Get a specific documentation topic.
 */
async function getDoc(topic: string): Promise<CallToolResult> {
  if (!topic) {
    return {
      content: [{ type: "text", text: "Error: topic parameter is required" }],
      isError: true,
    };
  }

  const docConfig = getDocConfig(topic);

  if (!docConfig) {
    const available = getAllTopics().join(", ");
    return {
      content: [
        {
          type: "text",
          text: `Error: Topic "${topic}" not found.\n\nAvailable topics: ${available}`,
        },
      ],
      isError: true,
    };
  }

  const content = await fetchDoc(docConfig);

  const header = `# ${docConfig.title}
**Category**: ${docConfig.category}
**Source**: ${docConfig.source.type}

---

`;

  return {
    content: [{ type: "text", text: header + content }],
  };
}

/**
 * Search across all documentation.
 */
async function searchDocsHandler(query: string, limit: number): Promise<CallToolResult> {
  if (!query) {
    return {
      content: [{ type: "text", text: "Error: query parameter is required" }],
      isError: true,
    };
  }

  const cappedLimit = Math.min(limit, 20);
  const results = await searchDocs(query, cappedLimit);

  if (results.length === 0) {
    return {
      content: [
        {
          type: "text",
          text: `No results found for "${query}".\n\nTry using different search terms or call list_topics to see available documentation.`,
        },
      ],
    };
  }

  const output = `# Search Results for "${query}"

Found ${results.length} matching document(s):

${results
  .map(
    (r, i) => `## ${i + 1}. ${r.title}
**Topic**: ${r.topic}
**Category**: ${r.category}
**Relevance**: ${r.score.toFixed(1)}

> ${r.excerpt}
`
  )
  .join("\n")}

---
Use \`get_doc\` with a topic name to retrieve the full document.`;

  return {
    content: [{ type: "text", text: output }],
  };
}
