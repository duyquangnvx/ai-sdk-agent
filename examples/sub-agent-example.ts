/**
 * Sub-Agent Example
 *
 * This example demonstrates how to use the sub-agent system
 * for complex tasks that require delegation.
 */

import { Agent, createTool } from '../src/index.js';
import model from './model.js';
import { z } from 'zod';

async function subAgentExample() {
  // Create main agent that can spawn sub-agents
  const agent = new Agent({
    name: 'main-agent',
    model: model,
    systemPrompt: `You are a project manager agent.
When faced with complex research tasks, you can delegate to sub-agents.
Use sub-agents for tasks that require focused investigation.`,

    // Enable sub-agent spawning
    canSpawnSubAgents: true,

    // Define tools
    tools: {
      searchFiles: createTool({
        name: 'searchFiles',
        description: 'Search for files in the codebase',
        schema: z.object({
          query: z.string().describe('Search query'),
          fileType: z.string().optional().describe('File extension filter'),
        }),
        execute: async ({ query, fileType }) => {
          // Simulated file search
          return {
            files: [`src/${query}.ts`, `tests/${query}.test.ts`],
            query,
            fileType,
          };
        },
        availableToSubAgents: true, // Allow sub-agents to use this tool
      }).tool,

      readFile: createTool({
        name: 'readFile',
        description: 'Read contents of a file',
        schema: z.object({
          path: z.string().describe('File path'),
        }),
        execute: async ({ path }) => {
          // Simulated file read
          return {
            path,
            content: `// Contents of ${path}\nexport function example() { return 42; }`,
          };
        },
        availableToSubAgents: true,
      }).tool,

      writeFile: createTool({
        name: 'writeFile',
        description: 'Write contents to a file',
        schema: z.object({
          path: z.string().describe('File path'),
          content: z.string().describe('File content'),
        }),
        execute: async ({ path, content }) => {
          // Simulated file write
          return { success: true, path };
        },
        availableToSubAgents: false, // Only main agent can write files
      }).tool,
    },

    maxSteps: 20,
  });

  // Execute a task that might spawn sub-agents
  const result = await agent.execute(
    'Research all authentication-related code in the project and summarize the patterns used.'
  );

  console.log('Main agent result:', result.result);
  console.log('Total steps:', result.steps.length);

  // Check for sub-agent spawns
  const subAgentSteps = result.steps.filter((s) => s.type === 'sub-agent');
  console.log('Sub-agent spawns:', subAgentSteps.length);

  for (const step of subAgentSteps) {
    console.log(`  Sub-agent ${step.subAgentId}: ${step.input}`);
  }
}

// Demonstrate manual sub-agent spawning
async function manualSubAgentExample() {
  const agent = new Agent({
    name: 'main-agent',
    model: model,
    systemPrompt: 'You are a helpful assistant.',
    canSpawnSubAgents: true,
    tools: {
      analyze: createTool({
        name: 'analyze',
        description: 'Analyze code',
        schema: z.object({ code: z.string() }),
        execute: async ({ code }) => ({ analysis: `Analyzed: ${code.slice(0, 50)}...` }),
        availableToSubAgents: true,
      }).tool,
    },
  });

  // Manually spawn a sub-agent for a specific task
  const subResult = await agent.spawnSubAgent({
    task: 'Analyze the authentication module and identify security patterns',
    allowedTools: ['analyze'], // Limit which tools sub-agent can use
    maxSteps: 5, // Limit sub-agent steps
  });

  console.log('Sub-agent result:', subResult.result);
  console.log('Sub-agent steps:', subResult.steps.length);
  console.log('Sub-agent success:', subResult.success);
}

// Main
async function main() {
  console.log('=== Sub-Agent Example ===');
  await subAgentExample();

  console.log('\n=== Manual Sub-Agent Example ===');
  await manualSubAgentExample();
}

main().catch(console.error);
