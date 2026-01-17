/**
 * MCP Resources implementation.
 * Exposes organization documentation as MCP resources.
 */

import { DOC_SOURCES, getDocConfig } from "./config/doc-sources.js";
import { fetchDoc } from "./sources/index.js";

/**
 * Resource definition for MCP
 */
export interface MCPResource {
  uri: string;
  name: string;
  title: string;
  description: string;
  mimeType: string;
  annotations?: {
    audience?: string[];
    priority?: number;
  };
}

/**
 * Resource content for MCP
 */
export interface MCPResourceContent {
  uri: string;
  mimeType: string;
  text: string;
}

/**
 * URI scheme for organization documentation
 */
const URI_SCHEME = "orgdocs";

/**
 * Build URI for a documentation topic
 */
export function buildDocUri(topic: string, category: string): string {
  return `${URI_SCHEME}://${category}/${topic}`;
}

/**
 * Parse an org docs URI
 */
export function parseDocUri(uri: string): { category: string; topic: string } | null {
  const match = uri.match(/^orgdocs:\/\/(\w+)\/(.+)$/);
  if (!match) return null;
  return {
    category: match[1],
    topic: match[2],
  };
}

/**
 * List all available resources.
 */
export function listResources(): MCPResource[] {
  return DOC_SOURCES.map((doc) => ({
    uri: buildDocUri(doc.topic, doc.category),
    name: doc.topic,
    title: doc.title,
    description: doc.description,
    mimeType: "text/markdown",
    annotations: {
      audience: ["assistant"],
      priority: doc.priority,
    },
  }));
}

/**
 * Read a specific resource.
 */
export async function readResource(uri: string): Promise<MCPResourceContent[]> {
  const parsed = parseDocUri(uri);
  
  if (!parsed) {
    throw new Error(`Invalid resource URI: ${uri}`);
  }
  
  const docConfig = getDocConfig(parsed.topic);
  
  if (!docConfig) {
    throw new Error(`Resource not found: ${uri}`);
  }
  
  const content = await fetchDoc(docConfig);
  
  return [
    {
      uri,
      mimeType: "text/markdown",
      text: content,
    },
  ];
}

/**
 * List resource templates (parameterized resources).
 */
export function listResourceTemplates(): Array<{
  uriTemplate: string;
  name: string;
  description: string;
  mimeType: string;
}> {
  return [
    {
      uriTemplate: `${URI_SCHEME}://{category}/{topic}`,
      name: "Organization Documentation",
      description: "Access documentation by category (internal/public) and topic",
      mimeType: "text/markdown",
    },
  ];
}
