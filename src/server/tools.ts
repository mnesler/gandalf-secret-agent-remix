/**
 * MCP Tools implementation.
 * Exposes tools for querying organization documentation.
 */

import type { CallToolResult, Tool } from "@modelcontextprotocol/sdk/types.js";
import { getAllDocSources, getDocConfig, getAllTopics, getDocsByCategory } from "./config/doc-sources.js";
import { fetchDoc, previewURL } from "./sources/index.js";
import { searchDocs } from "./search.js";
import { addUserDoc, removeUserDoc, listUserDocs } from "./config/user-docs.js";

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
    {
      name: "preview_url",
      description:
        "Preview a URL to extract title and content summary. " +
        "Use this before adding a doc with add_doc to show the user what will be added.",
      inputSchema: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "URL to preview",
          },
        },
        required: ["url"],
      },
    },
    {
      name: "add_doc",
      description:
        "Add a new documentation source. " +
        "The agent should preview the URL first, then call this to persist.",
      inputSchema: {
        type: "object",
        properties: {
          topic: {
            type: "string",
            description: "Unique topic name (e.g., 'gcp-bucket-naming')",
          },
          title: {
            type: "string",
            description: "Human-readable title",
          },
          description: {
            type: "string",
            description: "Brief description of what this doc covers",
          },
          url: {
            type: "string",
            description: "Full URL to the documentation",
          },
        },
        required: ["topic", "title", "description", "url"],
      },
    },
    {
      name: "remove_doc",
      description:
        "Remove a user-added documentation source by topic name.",
      inputSchema: {
        type: "object",
        properties: {
          topic: {
            type: "string",
            description: "Topic name to remove",
          },
        },
        required: ["topic"],
      },
    },
    {
      name: "list_user_docs",
      description:
        "List all documentation sources added by the user via /updoot.",
      inputSchema: {
        type: "object",
        properties: {},
        required: [],
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
      case "preview_url":
        return await previewUrlHandler(args.url as string);
      case "add_doc":
        return await addDocHandler(
          args.topic as string,
          args.title as string,
          args.description as string,
          args.url as string
        );
      case "remove_doc":
        return await removeDocHandler(args.topic as string);
      case "list_user_docs":
        return listUserDocsHandler();
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
  const internal = getDocsByCategory("internal");
  const publicDocs = getDocsByCategory("public");
  const userDocs = getDocsByCategory("user");

  let output = `# Available Documentation

## Internal Standards (Organization-specific)
${internal.map((d) => `- **${d.topic}**: ${d.description}`).join("\n")}

## Public Reference Documentation
${publicDocs.map((d) => `- **${d.topic}**: ${d.description}`).join("\n")}`;

  if (userDocs.length > 0) {
    output += `

## User-Added Documentation
${userDocs.map((d) => `- **${d.topic}**: ${d.description}`).join("\n")}`;
  }

  output += `

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
 * Preview a URL to extract title and content summary.
 */
async function previewUrlHandler(url: string): Promise<CallToolResult> {
  if (!url) {
    return {
      content: [{ type: "text", text: "Error: url parameter is required" }],
      isError: true,
    };
  }

  try {
    const preview = await previewURL(url);
    
    const output = `# URL Preview: ${preview.title}

**URL**: ${url}
**Title**: ${preview.title}
${preview.description ? `**Description**: ${preview.description}\n` : ""}

**Content Preview**:
${preview.contentPreview}

---
Use \`add_doc\` to add this as a documentation source.`;

    return {
      content: [{ type: "text", text: output }],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error previewing URL: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * Add a new user documentation source.
 */
async function addDocHandler(
  topic: string,
  title: string,
  description: string,
  url: string
): Promise<CallToolResult> {
  if (!topic || !title || !description || !url) {
    return {
      content: [{ type: "text", text: "Error: topic, title, description, and url are required" }],
      isError: true,
    };
  }

  try {
    addUserDoc({ topic, title, description, url });
    
    return {
      content: [
        {
          type: "text",
          text: `✅ Added documentation source!

**Topic**: ${topic}
**Title**: ${title}
**Description**: ${description}
**URL**: ${url}

You can now use:
- \`get_doc('${topic}')\` to fetch this document
- \`search_docs('${topic}')\` to find it in searches

The document is saved to ~/.config/gandalf/docs.json`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error adding document: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * Remove a user documentation source.
 */
async function removeDocHandler(topic: string): Promise<CallToolResult> {
  if (!topic) {
    return {
      content: [{ type: "text", text: "Error: topic parameter is required" }],
      isError: true,
    };
  }

  try {
    const removed = removeUserDoc(topic);
    
    if (removed) {
      return {
        content: [
          {
            type: "text",
            text: `✅ Removed documentation source: ${topic}`,
          },
        ],
      };
    } else {
      return {
        content: [
          {
            type: "text",
            text: `❌ Documentation source "${topic}" not found. Use \`list_user_docs\` to see available user docs.`,
          },
        ],
        isError: true,
      };
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error removing document: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * List all user-added documentation sources.
 */
function listUserDocsHandler(): CallToolResult {
  const userDocs = listUserDocs();
  
  if (userDocs.length === 0) {
    return {
      content: [
        {
          type: "text",
          text: "No user documentation sources found.\n\nUse `/updoot` to add documentation sources.",
        },
      ],
    };
  }

  const output = `# User Documentation Sources

Found ${userDocs.length} user-added documentation source(s):

| Topic | Title | URL | Added |
|-------|-------|-----|-------|
${userDocs
  .map(
    (doc) =>
      `| ${doc.topic} | ${doc.title} | ${doc.url} | ${new Date(doc.addedAt).toLocaleDateString()} |`
  )
  .join("\n")}

---
Use \`get_doc('<topic>')\` to fetch a specific document.
Use \`remove_doc('<topic>')\` to remove a document.`;

  return {
    content: [{ type: "text", text: output }],
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
