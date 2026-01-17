/**
 * GCP Documentation source adapter.
 * Fetches documentation from cloud.google.com.
 */

import { docCache } from "../cache.js";
import type { GCPSource } from "../config/doc-sources.js";
import TurndownService from "turndown";

const GCP_DOCS_BASE = "https://cloud.google.com";

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
});

/**
 * Fetch documentation from GCP docs site.
 * Converts HTML to Markdown for easier consumption.
 */
export async function fetchFromGCP(source: GCPSource): Promise<string> {
  const cacheKey = `gcp:${source.product}:${source.page}`;
  
  const cached = docCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const { product, page } = source;
  const url = `${GCP_DOCS_BASE}/${product}/${page}`;
  
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Org-Docs-MCP-Server",
      Accept: "text/html",
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`GCP documentation not found: ${product}/${page}`);
    }
    throw new Error(`GCP docs error: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  
  const content = extractGCPContent(html);
  const markdown = turndown.turndown(content);
  
  docCache.set(cacheKey, markdown);
  
  return markdown;
}

/**
 * Extract main documentation content from GCP HTML page.
 */
function extractGCPContent(html: string): string {
  const patterns = [
    /<article[^>]*class="[^"]*devsite-article[^"]*"[^>]*>([\s\S]*?)<\/article>/i,
    /<div[^>]*class="[^"]*devsite-article-body[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<main[^>]*>([\s\S]*?)<\/main>/i,
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
 * Clean HTML by removing scripts, styles, and navigation elements
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
 * Check if GCP docs are accessible
 */
export async function checkGCPAccess(): Promise<boolean> {
  try {
    const response = await fetch(`${GCP_DOCS_BASE}/storage/docs`, {
      method: "HEAD",
      headers: { "User-Agent": "Org-Docs-MCP-Server" },
    });
    return response.ok;
  } catch {
    return false;
  }
}
