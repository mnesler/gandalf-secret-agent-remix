/**
 * Generic URL source adapter.
 * Fetches content from any URL, converts HTML to markdown.
 */

import TurndownService from "turndown";
import { docCache } from "../cache.js";

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
});

/**
 * Fetch content from a URL, converting HTML to markdown if needed.
 */
export async function fetchFromURL(url: string): Promise<string> {
  const cacheKey = `url:${url}`;
  
  const cached = docCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const response = await fetch(url, {
    headers: {
      "User-Agent": "Gandalf-MCP-Server/1.0",
      Accept: "text/html, text/markdown, text/plain, */*",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get("content-type") || "";
  const text = await response.text();
  
  let content: string;
  
  if (contentType.includes("text/html")) {
    // Convert HTML to markdown
    content = turndown.turndown(text);
  } else {
    // Assume markdown or plain text
    content = text;
  }

  docCache.set(cacheKey, content);
  
  return content;
}

/**
 * Preview a URL to extract title and basic info (for /updoot flow)
 */
export async function previewURL(url: string): Promise<{
  title: string;
  description?: string;
  contentPreview: string;
}> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Gandalf-MCP-Server/1.0",
      Accept: "text/html, text/markdown, text/plain, */*",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get("content-type") || "";
  const text = await response.text();
  
  let title = "Untitled Document";
  let description: string | undefined;
  let contentPreview: string;
  
  if (contentType.includes("text/html")) {
    // Extract title from HTML
    const titleMatch = text.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
      title = titleMatch[1].trim();
    }
    
    // Extract meta description
    const descMatch = text.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
    if (descMatch) {
      description = descMatch[1].trim();
    }
    
    // Convert to markdown for preview
    const markdown = turndown.turndown(text);
    contentPreview = markdown.slice(0, 500) + (markdown.length > 500 ? "..." : "");
  } else {
    // For markdown/text, extract first line as title if it starts with #
    const lines = text.split('\n');
    const firstLine = lines[0]?.trim();
    if (firstLine?.startsWith('#')) {
      title = firstLine.replace(/^#+\s*/, '');
    }
    
    contentPreview = text.slice(0, 500) + (text.length > 500 ? "..." : "");
  }
  
  return {
    title: title.replace(/\s+/g, ' ').trim(),
    description,
    contentPreview: contentPreview.trim(),
  };
}