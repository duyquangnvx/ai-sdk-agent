/**
 * Basic Agent Example
 *
 * This example demonstrates how to create and use a basic agent
 * with custom tools and instructions.
 */

import { Agent, createTool, InstructionsLoaderUtils } from '../src/index.js';
import model from './model.js';
import { z } from 'zod';

// Create an agent with basic configuration
async function basicExample() {
  const agent = new Agent({
    name: 'basic-assistant',
    model: model,
    systemPrompt: 'You are a helpful assistant that can perform calculations.',

    // Register custom tools
    tools: {
      calculate: createTool({
        name: 'calculate',
        description: 'Perform a mathematical calculation',
        schema: z.object({
          expression: z.string().describe('The mathematical expression to evaluate'),
        }),
        execute: async ({ expression }) => {
          try {
            // Simple eval for demo (use a proper math library in production)
            const result = eval(expression);
            return { result, expression };
          } catch {
            return { error: 'Invalid expression' };
          }
        },
      }).tool,
    },

    // Context configuration
    context: {
      maxTokens: 50000,
      compactThreshold: 0.8,
      compactStrategy: 'summarize',
    },

    // Max steps before stopping
    maxSteps: 10,
  });

  // Execute the agent
  const result = await agent.execute('What is 25 * 4 + 100?');

  console.log('Result:', result.result);
  console.log('Steps:', result.steps.length);
  console.log('Success:', result.success);
  console.log('Usage:', result.usage);
}

// Create an agent with custom instructions loaded from file
async function instructionsExample() {
  const agent = new Agent({
    name: 'custom-instructions-agent',
    model: model,

    // Load instructions from file (like CLAUDE.md)
    instructions: InstructionsLoaderUtils.fromFileOrDefault(
      './AGENT_INSTRUCTIONS.md',
      'You are a helpful assistant. Be concise and accurate.'
    ),

    maxSteps: 20,
  });

  const result = await agent.execute('Help me understand this codebase');
  console.log('Result:', result.result);
}

// Create an agent with dynamic model selection
async function dynamicModelExample() {
  const agent = new Agent({
    name: 'dynamic-model-agent',
    model: model, // Default model

    // Define call options schema
    callOptionsSchema: z.object({
      priority: z.enum(['low', 'normal', 'high']),
      taskType: z.enum(['simple', 'complex']).optional(),
    }),

    // Dynamic configuration based on options
    prepareCall: async ({ options }) => {
      if (options?.priority === 'high' || options?.taskType === 'complex') {
        return {
          model: model, // Use more capable model
          maxSteps: 30,
        };
      }
      return {
        maxSteps: 10,
      };
    },

    maxSteps: 20,
  });

  // Execute with high priority
  const result = await agent.execute('Analyze this complex problem', {
    options: { priority: 'high', taskType: 'complex' },
  });

  console.log('Result:', result.result);
}

// Create an agent with lifecycle callbacks
async function callbacksExample() {
  const agent = new Agent({
    name: 'callback-agent',
    model: model,

    onStart: async ({ agentId, timestamp }) => {
      console.log(`Agent ${agentId} started at ${timestamp}`);
    },

    onStep: async (step) => {
      console.log(`Step ${step.stepNumber}: ${step.type}`);
      if (step.toolName) {
        console.log(`  Tool: ${step.toolName}`);
      }
    },

    onComplete: async ({ agentId, timestamp }) => {
      console.log(`Agent ${agentId} completed at ${timestamp}`);
    },

    onError: async ({ error, agentId }) => {
      console.error(`Agent ${agentId} error:`, error.message);
    },
  });

  const result = await agent.execute('Hello, how are you?');
  console.log('Final result:', result.result);
}

// Main
async function main() {
  console.log('=== Basic Example ===');
  await basicExample();

  console.log('\n=== Dynamic Model Example ===');
  await dynamicModelExample();

  console.log('\n=== Callbacks Example ===');
  await callbacksExample();
}

// Run examples
main().catch(console.error);
