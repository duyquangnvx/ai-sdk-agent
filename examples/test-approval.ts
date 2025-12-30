/**
 * Test tool approval functionality
 * Demonstrates AI SDK v6's needsApproval feature
 */

import { Agent, createTool, createToolBuilder } from '../src/index.js';
import model from './model.js';
import { z } from 'zod';

// Tool that always requires approval
const deleteFileTool = createTool({
  name: 'deleteFile',
  description: 'Delete a file from the filesystem',
  schema: z.object({
    path: z.string().describe('The path to the file to delete'),
  }),
  execute: async ({ path }) => {
    console.log(`[MOCK] Would delete file: ${path}`);
    return { deleted: path, success: true };
  },
  needsApproval: true, // Always require approval
});

// Tool with dynamic approval based on input
const paymentTool = createTool({
  name: 'processPayment',
  description: 'Process a payment transaction',
  schema: z.object({
    amount: z.number().describe('The payment amount'),
    recipient: z.string().describe('The recipient of the payment'),
  }),
  execute: async ({ amount, recipient }) => {
    console.log(`[MOCK] Processing payment of $${amount} to ${recipient}`);
    return { transactionId: 'tx_' + Date.now(), amount, recipient };
  },
  // Only require approval for large amounts
  needsApproval: async ({ amount }) => amount > 100,
});

// Using builder pattern with approval
const shellTool = createToolBuilder()
  .name('runShell')
  .description('Run a shell command')
  .schema(
    z.object({
      command: z.string().describe('The shell command to run'),
    })
  )
  .execute(async ({ command }) => {
    console.log(`[MOCK] Would run: ${command}`);
    return { output: `Executed: ${command}`, exitCode: 0 };
  })
  .needsApproval(true) // Always require approval for shell commands
  .build();

async function main() {
  console.log('=== Tool Approval Example ===\n');

  const agent = new Agent({
    name: 'approval-test',
    model: model,
    systemPrompt: `You are a helpful assistant with access to sensitive tools.
When asked to delete files, process payments, or run commands, use the appropriate tools.
For this test, just demonstrate the tool calls.`,
    tools: {
      deleteFile: deleteFileTool.tool,
      processPayment: paymentTool.tool,
      runShell: shellTool.tool,
    },
    maxSteps: 5,
  });

  console.log('Tools registered with approval:');
  console.log('- deleteFile: needsApproval = true (always)');
  console.log('- processPayment: needsApproval = amount > 100 (dynamic)');
  console.log('- runShell: needsApproval = true (always)');
  console.log('\n');

  // Test with a small payment (should NOT need approval)
  console.log('Test 1: Small payment ($50 - should auto-execute)');
  const result1 = await agent.execute('Process a payment of $50 to Alice');
  console.log('Result:', result1.result);
  console.log('Steps:', result1.steps.length);
  console.log('\n');
}

main().catch(console.error);
