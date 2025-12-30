/**
 * Test streaming functionality
 *
 * Demonstrates streaming with AI SDK's TextStreamPart events:
 * - Full control: Handle all event types (text, reasoning, tools, etc.)
 * - Simple mode: Use onTextChunk callback for just text
 */

import { Agent } from '../src/index.js';
import model from './model.js';

// Approach 1: Full control with all AI SDK events
async function testFullStream() {
  const agent = new Agent({
    name: 'stream-test-full',
    model: model,
    systemPrompt: 'You are a helpful assistant. Be concise.',
    maxSteps: 5,
  });

  console.log('=== Approach 1: Full Stream (all AI SDK events) ===\n');
  console.log('Streaming with full event access:');
  process.stdout.write('> ');

  let textChunks = 0;
  let reasoningChunks = 0;

  for await (const part of agent.stream('Count from 1 to 5, each on a new line.')) {
    switch (part.type) {
      case 'text-delta':
        // Text chunks as they arrive
        process.stdout.write(part.text);
        textChunks++;
        break;

      case 'reasoning-delta':
        // Claude's extended thinking (if enabled)
        reasoningChunks++;
        break;

      case 'tool-call':
        console.log(`\n[Tool call: ${part.toolName}]`);
        break;

      case 'tool-result':
        console.log(`[Tool result: ${part.toolName}]`);
        break;

      case 'finish-step':
        console.log(`\n[Step finished: ${part.finishReason}]`);
        break;

      case 'error':
        console.error('\n[Error]:', part.error);
        break;
    }
  }

  console.log(`\nStats: ${textChunks} text chunks, ${reasoningChunks} reasoning chunks`);
}

// Approach 2: Simple text streaming with callback
async function testSimpleStream() {
  const agent = new Agent({
    name: 'stream-test-simple',
    model: model,
    systemPrompt: 'You are a helpful assistant. Be concise.',
    maxSteps: 5,
  });

  console.log('\n=== Approach 2: Simple Stream (onTextChunk callback) ===\n');
  console.log('Streaming with callback:');
  process.stdout.write('> ');

  let chunkCount = 0;

  // Simple API - just provide onTextChunk callback
  const result = await consumeStream(
    agent.stream('Say "Hello, World!" and nothing else.', {
      onTextChunk: (chunk, accumulated) => {
        process.stdout.write(chunk);
        chunkCount++;
      },
    })
  );

  console.log(`\nStats: ${chunkCount} chunks, Result: "${result.result}"`);
}

// Approach 3: Tool call streaming
async function testToolStream() {
  const { createTool } = await import('../src/index.js');
  const { z } = await import('zod');

  const agent = new Agent({
    name: 'stream-test-tools',
    model: model,
    systemPrompt: 'You are a helpful assistant with a calculator.',
    tools: {
      calculate: createTool({
        name: 'calculate',
        description: 'Perform a calculation',
        schema: z.object({
          expression: z.string().describe('Math expression to evaluate'),
        }),
        execute: async ({ expression }) => {
          const result = eval(expression);
          return { expression, result };
        },
      }).tool,
    },
    maxSteps: 5,
  });

  console.log('\n=== Approach 3: Tool Call Streaming ===\n');
  console.log('Streaming with tool calls:');

  for await (const part of agent.stream('What is 42 * 17?')) {
    switch (part.type) {
      case 'text-delta':
        process.stdout.write(part.text);
        break;

      case 'tool-input-start':
        console.log(`\n[Tool input starting: ${part.toolName}]`);
        break;

      case 'tool-input-delta':
        // Tool input streaming (JSON being built)
        process.stdout.write(part.delta);
        break;

      case 'tool-call':
        console.log(`\n[Tool called: ${part.toolName}(${JSON.stringify(part.input)})]`);
        break;

      case 'tool-result':
        console.log(`[Tool result: ${JSON.stringify(part.output)}]`);
        break;

      case 'finish':
        console.log(`\n[Finished: ${part.finishReason}]`);
        break;
    }
  }
}

// Helper to consume a stream and get the result
async function consumeStream<T>(
  stream: AsyncGenerator<unknown, T>
): Promise<T> {
  let result: IteratorResult<unknown, T>;
  do {
    result = await stream.next();
  } while (!result.done);
  return result.value;
}

// Main
async function main() {
  await testFullStream();
  await testSimpleStream();
  await testToolStream();
}

main().catch(console.error);
