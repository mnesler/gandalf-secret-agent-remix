/**
 * Tekton Documentation source adapter.
 * Fetches documentation from tekton.dev.
 */

import { docCache } from "../cache.js";
import type { TektonSource } from "../config/doc-sources.js";
import TurndownService from "turndown";

const TEKTON_DOCS_BASE = "https://tekton.dev/docs";

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
});

/**
 * Fetch documentation from Tekton docs site.
 */
export async function fetchFromTekton(source: TektonSource): Promise<string> {
  const cacheKey = `tekton:${source.docPath}`;
  
  const cached = docCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const { docPath } = source;
  const url = `${TEKTON_DOCS_BASE}/${docPath}/`;
  
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Org-Docs-MCP-Server",
      Accept: "text/html",
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Tekton documentation not found: ${docPath}`);
    }
    throw new Error(`Tekton docs error: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  
  const content = extractTektonContent(html);
  const markdown = turndown.turndown(content);
  
  docCache.set(cacheKey, markdown);
  
  return markdown;
}

/**
 * Extract main documentation content from Tekton HTML page.
 */
function extractTektonContent(html: string): string {
  const patterns = [
    /<main[^>]*>([\s\S]*?)<\/main>/i,
    /<article[^>]*>([\s\S]*?)<\/article>/i,
    /<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      return cleanHTML(match[1]);
    }
  }

  return cleanHTML(html);
}

/**
 * Clean HTML content
 */
function cleanHTML(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Check if Tekton docs are accessible
 */
export async function checkTektonAccess(): Promise<boolean> {
  try {
    const response = await fetch(TEKTON_DOCS_BASE, {
      method: "HEAD",
      headers: { "User-Agent": "Org-Docs-MCP-Server" },
    });
    return response.ok;
  } catch {
    return false;
  }
}
