#!/usr/bin/env bun
/**
 * CLI for gandalf-secret-agent-remix
 * 
 * Commands:
 *   init   - Initialize OpenCode agent and MCP config in current project
 *   serve  - Run the MCP server (used by opencode.json)
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { startServer } from "./server/index.js";

const PACKAGE_DIR = dirname(dirname(import.meta.path));

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case "init":
      await initCommand();
      break;
    case "serve":
      await startServer();
      break;
    case "--help":
    case "-h":
    case undefined:
      showHelp();
      break;
    default:
      console.error(`Unknown command: ${command}`);
      showHelp();
      process.exit(1);
  }
}

function showHelp() {
  console.log(`
gandalf-secret-agent-remix - OpenCode MCP agent for infrastructure documentation

Usage:
  bunx github:mnesler/gandalf-secret-agent-remix <command>

Commands:
  init    Initialize agent and MCP config in current project
  serve   Run the MCP server (used internally by OpenCode)

Examples:
  bunx github:mnesler/gandalf-secret-agent-remix init
  
After init, start OpenCode and press Tab to switch to the infra-engineer agent.
`);
}

async function initCommand() {
  const cwd = process.cwd();
  
  console.log("Initializing gandalf-secret-agent-remix...\n");

  // 1. Create .opencode/agent directory
  const agentDir = join(cwd, ".opencode", "agent");
  if (!existsSync(agentDir)) {
    mkdirSync(agentDir, { recursive: true });
    console.log("Created .opencode/agent/");
  }

  // 2. Copy agent template
  const agentTemplatePath = join(PACKAGE_DIR, "src", "templates", "agent.md");
  const agentDestPath = join(agentDir, "infra-engineer.md");
  
  if (existsSync(agentDestPath)) {
    console.log("Agent already exists: .opencode/agent/infra-engineer.md (skipped)");
  } else {
    const agentTemplate = readFileSync(agentTemplatePath, "utf-8");
    writeFileSync(agentDestPath, agentTemplate);
    console.log("Created .opencode/agent/infra-engineer.md");
  }

  // 3. Create or merge opencode.json
  const opencodeJsonPath = join(cwd, "opencode.json");
  const mcpConfig = {
    orgdocs: {
      type: "local",
      command: ["bunx", "github:mnesler/gandalf-secret-agent-remix", "serve"],
      enabled: true,
      environment: {
        GITHUB_TOKEN: "{env:GITHUB_TOKEN}"
      }
    }
  };

  if (existsSync(opencodeJsonPath)) {
    // Merge with existing config
    try {
      const existing = JSON.parse(readFileSync(opencodeJsonPath, "utf-8"));
      existing.mcp = existing.mcp || {};
      existing.mcp.orgdocs = mcpConfig.orgdocs;
      existing.tools = existing.tools || {};
      existing.tools["orgdocs_*"] = true;
      writeFileSync(opencodeJsonPath, JSON.stringify(existing, null, 2) + "\n");
      console.log("Updated opencode.json with MCP config");
    } catch (e) {
      console.error("Failed to parse existing opencode.json:", e);
      process.exit(1);
    }
  } else {
    // Create new config
    const newConfig = {
      "$schema": "https://opencode.ai/config.json",
      mcp: mcpConfig,
      tools: {
        "orgdocs_*": true
      }
    };
    writeFileSync(opencodeJsonPath, JSON.stringify(newConfig, null, 2) + "\n");
    console.log("Created opencode.json");
  }

  // 4. Create .env.example if it doesn't exist
  const envExamplePath = join(cwd, ".env.example");
  if (!existsSync(envExamplePath)) {
    writeFileSync(envExamplePath, "# GitHub token for accessing private documentation repos\nGITHUB_TOKEN=your_github_pat_here\n");
    console.log("Created .env.example");
  }

  console.log(`
Setup complete!

Next steps:
1. Set your GitHub token:
   export GITHUB_TOKEN=ghp_your_token_here

2. Customize documentation sources:
   Edit src/server/config/doc-sources.ts to add your org's repos

3. Start OpenCode and press Tab to switch to 'infra-engineer' agent:
   opencode
`);
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
