/**
 * Full-text search across all documentation.
 */

import { getAllDocSources, type DocConfig } from "./config/doc-sources.js";
import { fetchDoc } from "./sources/index.js";

export interface SearchResult {
  topic: string;
  title: string;
  category: "internal" | "public" | "user";
  excerpt: string;
  score: number;
}

/**
 * Search across all documentation for matching content.
 * Returns results sorted by relevance score.
 */
export async function searchDocs(query: string, limit: number = 5): Promise<SearchResult[]> {
  const results: SearchResult[] = [];
  const queryLower = query.toLowerCase();
  const queryTerms = queryLower.split(/\s+/).filter(Boolean);
  
  for (const docConfig of getAllDocSources()) {
    try {
      const content = await fetchDoc(docConfig);
      const contentLower = content.toLowerCase();
      
      const score = calculateScore(queryTerms, contentLower, docConfig);
      
      if (score > 0) {
        const excerpt = extractExcerpt(content, query);
        
        results.push({
          topic: docConfig.topic,
          title: docConfig.title,
          category: docConfig.category,
          excerpt,
          score,
        });
      }
    } catch (error) {
      console.error(`Failed to search ${docConfig.topic}: ${error}`);
    }
  }
  
  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Calculate relevance score for a document.
 */
function calculateScore(queryTerms: string[], content: string, config: DocConfig): number {
  let score = 0;
  
  for (const term of queryTerms) {
    const contentMatches = (content.match(new RegExp(term, "gi")) || []).length;
    score += contentMatches;
    
    if (config.title.toLowerCase().includes(term)) {
      score += 10;
    }
    
    if (config.topic.toLowerCase().includes(term)) {
      score += 5;
    }
    
    if (config.description.toLowerCase().includes(term)) {
      score += 3;
    }
  }
  
  score *= config.priority;
  
  if (config.category === "internal") {
    score *= 1.2;
  } else if (config.category === "user") {
    score *= 1.1; // Slight boost for user-added docs
  }
  
  return score;
}

/**
 * Extract an excerpt around the first match of the query.
 */
function extractExcerpt(content: string, query: string, contextChars: number = 150): string {
  const queryLower = query.toLowerCase();
  const contentLower = content.toLowerCase();
  
  const index = contentLower.indexOf(queryLower);
  
  if (index === -1) {
    const firstTerm = query.split(/\s+/)[0]?.toLowerCase();
    const termIndex = firstTerm ? contentLower.indexOf(firstTerm) : -1;
    
    if (termIndex === -1) {
      return content.slice(0, contextChars * 2) + "...";
    }
    
    return extractAroundIndex(content, termIndex, contextChars);
  }
  
  return extractAroundIndex(content, index, contextChars);
}

/**
 * Extract content around a specific index.
 */
function extractAroundIndex(content: string, index: number, contextChars: number): string {
  const start = Math.max(0, index - contextChars);
  const end = Math.min(content.length, index + contextChars);
  
  let excerpt = content.slice(start, end);
  
  if (start > 0) {
    excerpt = "..." + excerpt;
  }
  if (end < content.length) {
    excerpt = excerpt + "...";
  }
  
  return excerpt.replace(/\s+/g, " ").trim();
}
