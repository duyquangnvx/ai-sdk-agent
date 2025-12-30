/**
 * Test streaming functionality
 * Demonstrates both approaches:
 * 1. Using yield (for await...of)
 * 2. Using onTextChunk callback
 */

import { Agent, type StreamEvent } from '../src/index.js';
import model from './model.js';

// Approach 1: Using yield to receive text chunks
async function testStreamWithYield() {
  const agent = new Agent({
    name: 'stream-test-yield',
    model: model,
    systemPrompt: 'You are a helpful assistant. Be very concise.',
    maxSteps: 5,
  });

  console.log('=== Approach 1: Using yield ===\n');
  console.log('Streaming (chunks appear as they arrive):');
  process.stdout.write('> ');

  let chunkCount = 0;
  let stepCount = 0;

  for await (const event of agent.stream('Count from 1 to 10, each on a new line.')) {
    if (event.type === 'text-chunk') {
      // Write chunk immediately without newline
      process.stdout.write(event.chunk);
      chunkCount++;
    } else if (event.type === 'step-complete') {
      stepCount++;
      console.log(`\n\n[Step ${event.step.stepNumber} complete: ${event.step.type}]`);
    }
  }

  console.log(`\nStats: ${chunkCount} chunks, ${stepCount} steps`);
}

// Approach 2: Using onTextChunk callback
async function testStreamWithCallback() {
  const agent = new Agent({
    name: 'stream-test-callback',
    model: model,
    systemPrompt: 'You are a helpful assistant. Be very concise.',
    maxSteps: 5,
  });

  console.log('\n=== Approach 2: Using onTextChunk callback ===\n');
  console.log('Streaming with callback:');
  process.stdout.write('> ');

  let chunkCount = 0;

  // The callback receives each chunk as it arrives
  // We still need to iterate the stream to completion
  for await (const event of agent.stream('Say "Goodbye World" and nothing else.', {
    onTextChunk: (chunk, accumulated) => {
      process.stdout.write(chunk);
      chunkCount++;
    },
  })) {
    // Callback handles text-chunk events
    // We can still handle step-complete events here if needed
    if (event.type === 'step-complete') {
      console.log(`\n\n[Step complete: ${event.step.type}]`);
    }
  }

  console.log(`Stats: ${chunkCount} chunks received via callback`);
}

// Main
async function main() {
  await testStreamWithYield();
  await testStreamWithCallback();
}

main().catch(console.error);
