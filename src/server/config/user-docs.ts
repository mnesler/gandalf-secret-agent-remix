/**
 * User-managed documentation sources.
 * Persisted to ~/.config/gandalf/docs.json
 * Watched for changes and hot-reloaded.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, watch } from "fs";
import { join } from "path";
import { homedir } from "os";
import type { DocConfig } from "./doc-sources.js";

const CONFIG_DIR = join(homedir(), ".config", "gandalf");
const USER_DOCS_PATH = join(CONFIG_DIR, "docs.json");

export interface UserDocSource {
  topic: string;
  title: string;
  description: string;
  url: string;
  addedAt: string;
}

interface UserDocsConfig {
  sources: UserDocSource[];
}

let userDocs: UserDocSource[] = [];
let changeListeners: Array<() => void> = [];

/**
 * Initialize user docs: load from file and start watching
 */
export function initUserDocs(): void {
  ensureConfigDir();
  loadUserDocs();
  watchUserDocs();
}

/**
 * Get user docs as DocConfig array (for merging with built-in)
 */
export function getUserDocsAsConfigs(): DocConfig[] {
  return userDocs.map((ud) => ({
    topic: ud.topic,
    title: ud.title,
    description: ud.description,
    category: "user" as const,
    priority: 0.9, // High priority for user docs
    source: {
      type: "url" as const,
      url: ud.url,
    },
  }));
}

/**
 * Add a new user doc source
 */
export function addUserDoc(doc: Omit<UserDocSource, "addedAt">): void {
  // Check for duplicate topic
  if (userDocs.some((d) => d.topic === doc.topic)) {
    throw new Error(`Topic "${doc.topic}" already exists`);
  }
  
  userDocs.push({
    ...doc,
    addedAt: new Date().toISOString(),
  });
  saveUserDocs();
}

/**
 * Remove a user doc by topic
 */
export function removeUserDoc(topic: string): boolean {
  const index = userDocs.findIndex((d) => d.topic === topic);
  if (index === -1) return false;
  
  userDocs.splice(index, 1);
  saveUserDocs();
  return true;
}

/**
 * List all user docs
 */
export function listUserDocs(): UserDocSource[] {
  return [...userDocs];
}

/**
 * Register a callback for when user docs change
 */
export function onUserDocsChange(callback: () => void): void {
  changeListeners.push(callback);
}

// --- Internal helpers ---

function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

function loadUserDocs(): void {
  if (!existsSync(USER_DOCS_PATH)) {
    userDocs = [];
    return;
  }
  
  try {
    const content = readFileSync(USER_DOCS_PATH, "utf-8");
    const config: UserDocsConfig = JSON.parse(content);
    userDocs = config.sources || [];
  } catch (e) {
    console.error("Failed to load user docs:", e);
    userDocs = [];
  }
}

function saveUserDocs(): void {
  const config: UserDocsConfig = { sources: userDocs };
  writeFileSync(USER_DOCS_PATH, JSON.stringify(config, null, 2) + "\n");
  notifyListeners();
}

function watchUserDocs(): void {
  if (!existsSync(USER_DOCS_PATH)) {
    // Create empty file so we can watch it
    saveUserDocs();
  }
  
  try {
    watch(USER_DOCS_PATH, (eventType) => {
      if (eventType === "change") {
        loadUserDocs();
        notifyListeners();
      }
    });
  } catch (e) {
    console.error("Failed to watch user docs file:", e);
  }
}

function notifyListeners(): void {
  for (const listener of changeListeners) {
    try {
      listener();
    } catch (e) {
      console.error("Error in user docs change listener:", e);
    }
  }
}