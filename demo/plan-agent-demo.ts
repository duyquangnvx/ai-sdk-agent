import "dotenv/config";
import {
  PlanAgent,
  createTool,
  NodeFilesystemBackend,
  type PlanAgentExtension,
} from "@voltagent/core";
import { google } from "@ai-sdk/google";
import { z } from "zod";

// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

// Tool 1: Web Search (mock implementation)
const webSearchTool = createTool({
  name: "web_search",
  description: "Search the web for information on any topic",
  parameters: z.object({
    query: z.string().describe("The search query"),
    maxResults: z.number().optional().default(5).describe("Maximum number of results"),
  }),
  execute: async ({ query, maxResults }) => {
    console.log(`[WebSearch] Searching for: "${query}" (max: ${maxResults} results)`);

    // Mock search results - replace with real API (e.g., Tavily, SerpAPI)
    const mockResults = [
      {
        title: `Result 1 for "${query}"`,
        url: `https://example.com/result1`,
        snippet: `This is a comprehensive article about ${query}. It covers the main concepts and provides detailed explanations.`,
      },
      {
        title: `Result 2 for "${query}"`,
        url: `https://example.com/result2`,
        snippet: `An in-depth analysis of ${query} with practical examples and use cases.`,
      },
      {
        title: `Result 3 for "${query}"`,
        url: `https://example.com/result3`,
        snippet: `Latest updates and news about ${query} from industry experts.`,
      },
    ];

    return {
      query,
      results: mockResults.slice(0, maxResults),
      totalResults: mockResults.length,
    };
  },
});

// Tool 2: Calculator
const calculatorTool = createTool({
  name: "calculator",
  description: "Perform mathematical calculations",
  parameters: z.object({
    expression: z.string().describe("Mathematical expression to evaluate (e.g., '2 + 2 * 3')"),
  }),
  execute: async ({ expression }) => {
    console.log(`[Calculator] Evaluating: ${expression}`);
    try {
      // Safe evaluation using Function constructor
      const sanitized = expression.replace(/[^0-9+\-*/().%\s]/g, "");
      const result = new Function(`return ${sanitized}`)();
      return { expression, result, success: true };
    } catch (error) {
      return {
        expression,
        result: null,
        success: false,
        error: "Invalid expression",
      };
    }
  },
});

// Tool 3: Note Taking
const notesTool = createTool({
  name: "take_notes",
  description: "Save important notes or findings for later reference",
  parameters: z.object({
    title: z.string().describe("Title of the note"),
    content: z.string().describe("Content of the note"),
    tags: z.array(z.string()).optional().describe("Tags for categorization"),
  }),
  execute: async ({ title, content, tags }) => {
    console.log(`[Notes] Saving note: "${title}"`);
    const timestamp = new Date().toISOString();
    return {
      saved: true,
      note: {
        id: `note_${Date.now()}`,
        title,
        content,
        tags: tags || [],
        createdAt: timestamp,
      },
    };
  },
});

// ============================================================================
// CUSTOM EXTENSION
// ============================================================================

const loggingExtension: PlanAgentExtension = {
  name: "logging",
  apply: () => ({
    systemPrompt: `
Always log your reasoning process:
1. State your understanding of the task
2. Explain your plan before executing
3. Report progress after each major step
4. Summarize findings at the end
`,
  }),
};

// ============================================================================
// PLAN AGENT EXAMPLES
// ============================================================================

async function runBasicPlanAgent() {
  console.log("\n" + "=".repeat(60));
  console.log("EXAMPLE 1: Basic PlanAgent");
  console.log("=".repeat(60) + "\n");

  const agent = new PlanAgent({
    name: "BasicResearcher",
    systemPrompt: `You are a helpful research assistant.
When given a task:
1. First create a plan using write_todos
2. Execute each step methodically
3. Provide a clear summary at the end`,
    model: google("gemini-2.0-flash-exp"),
    tools: [webSearchTool, calculatorTool, notesTool],
    // Planning enabled by default
    planning: {
      systemPrompt: "Always create a clear plan with 3-5 steps before starting any research task.",
    },
  });

  try {
    console.log("[INFO] Starting generateText...");

    const result = await agent.generateText(
      "Research the benefits of TypeScript over JavaScript and calculate the percentage of developers who prefer TypeScript (assume 65 out of 100 surveyed prefer it).",
      {
        maxSteps: 10, // Allow enough steps to complete planning + execution + summary
      }
    );

    console.log("\n--- Result ---");
    console.log("Text:", result.text || "(no text)");

    // Log other useful properties
    if (result.usage) {
      console.log("\n--- Token Usage ---");
      console.log("Prompt tokens:", result.usage.inputTokens);
      console.log("Completion tokens:", result.usage.outputTokens);
      console.log("Total tokens:", result.usage.totalTokens);
    }

    if (result.finishReason) {
      console.log("\nFinish reason:", result.finishReason);
    }

    if (result.toolCalls && result.toolCalls.length > 0) {
      console.log("\n--- Tool Calls ---");
      console.log(JSON.stringify(result.toolCalls, null, 2));
    }

    if (result.toolResults && result.toolResults.length > 0) {
      console.log("\n--- Tool Results ---");
      console.log(JSON.stringify(result.toolResults, null, 2));
    }

    // Log all keys in result for debugging
    console.log("\n--- Available Result Keys ---");
    console.log(Object.keys(result));
  } catch (error) {
    console.error("\n[ERROR] Failed to generate text:");
    console.error(error);
  }
}

async function runPlanAgentWithFilesystem() {
  console.log("\n" + "=".repeat(60));
  console.log("EXAMPLE 2: PlanAgent with Filesystem");
  console.log("=".repeat(60) + "\n");

  const agent = new PlanAgent({
    name: "FileResearcher",
    systemPrompt: `You are a research assistant with filesystem access.
You can:
- Read and write files to persist information
- Use the filesystem to store research notes
- Organize findings in structured files`,
    model: google("gemini-2.0-flash-exp"),
    tools: [webSearchTool],
    filesystem: {
      backend: new NodeFilesystemBackend({
        rootDir: "./.voltagent/plan-agent-workspace",
        virtualMode: true, // Safe mode - doesn't affect real filesystem
      }),
    },
  });

  const result = await agent.generateText(
    "Research AI agents and save a summary to a file called 'ai-agents-research.md'"
  );

  console.log("\n--- Result ---");
  console.log(result.text);
}

async function runPlanAgentWithSubagents() {
  console.log("\n" + "=".repeat(60));
  console.log("EXAMPLE 3: PlanAgent with Subagents");
  console.log("=".repeat(60) + "\n");

  const agent = new PlanAgent({
    name: "ResearchSupervisor",
    systemPrompt: `You are a research supervisor that delegates tasks to specialized agents.
- Use the research-analyst for deep research
- Use the data-analyst for calculations and data analysis
- Combine their findings into comprehensive reports`,
    model: google("gemini-2.0-flash-exp"),
    subagents: [
      {
        name: "research-analyst",
        description: "Expert at searching and synthesizing information from multiple sources",
        systemPrompt:
          "You are a research analyst. Search for information thoroughly and provide detailed, well-sourced summaries.",
        model: google("gemini-2.0-flash-exp"),
        tools: [webSearchTool, notesTool],
      },
      {
        name: "data-analyst",
        description: "Expert at calculations, data analysis, and statistical interpretation",
        systemPrompt:
          "You are a data analyst. Perform calculations accurately and explain the meaning of numbers in context.",
        model: google("gemini-2.0-flash-exp"),
        tools: [calculatorTool],
      },
    ],
    task: {
      taskDescription: "Delegate complex tasks to appropriate subagents for specialized work.",
      maxSteps: 10,
    },
    generalPurposeAgent: false, // Only use our defined subagents
  });

  const result = await agent.generateText(
    "I need a report on AI adoption in enterprises. Research the topic and calculate the growth rate if AI adoption was 35% in 2022 and 58% in 2024."
  );

  console.log("\n--- Result ---");
  console.log(result.text);
}

async function runPlanAgentWithSummarization() {
  console.log("\n" + "=".repeat(60));
  console.log("EXAMPLE 4: PlanAgent with Summarization & Extensions");
  console.log("=".repeat(60) + "\n");

  const agent = new PlanAgent({
    name: "EfficientResearcher",
    systemPrompt: "You are a research assistant optimized for long conversations.",
    model: google("gemini-2.0-flash-exp"),
    tools: [webSearchTool, notesTool],
    // Summarization for long conversations
    summarization: {
      triggerTokens: 50000, // Summarize when context exceeds this
      keepMessages: 4, // Keep last 4 messages intact
      maxOutputTokens: 500, // Summary max length
    },
    // Evict large tool results to save context
    toolResultEviction: {
      enabled: true,
      tokenLimit: 10000,
    },
    // Custom extension
    extensions: [loggingExtension],
  });

  const result = await agent.generateText(
    "Research the latest trends in AI development and provide a comprehensive summary."
  );

  console.log("\n--- Result ---");
  console.log(result.text);
}

async function runPlanAgentWithoutPlanning() {
  console.log("\n" + "=".repeat(60));
  console.log("EXAMPLE 5: PlanAgent without Planning (Quick Mode)");
  console.log("=".repeat(60) + "\n");

  const agent = new PlanAgent({
    name: "QuickAssistant",
    systemPrompt: "You are a quick assistant. Answer directly without extensive planning.",
    model: google("gemini-2.0-flash-exp"),
    tools: [calculatorTool],
    planning: false, // Disable planning for simple tasks
  });

  const result = await agent.generateText("What is 15% of 250?");

  console.log("\n--- Result ---");
  console.log(result.text);
}

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

async function main() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║              VOLTAGENT PLANAGENT DEMO                      ║");
  console.log("╚════════════════════════════════════════════════════════════╝");

  const examples = [
    { name: "Basic PlanAgent", fn: runBasicPlanAgent },
    { name: "With Filesystem", fn: runPlanAgentWithFilesystem },
    { name: "With Subagents", fn: runPlanAgentWithSubagents },
    { name: "With Summarization", fn: runPlanAgentWithSummarization },
    { name: "Without Planning", fn: runPlanAgentWithoutPlanning },
  ];

  // Get example number from command line argument
  const exampleNum = process.argv[2] ? Number.parseInt(process.argv[2], 10) : null;

  if (exampleNum && exampleNum >= 1 && exampleNum <= examples.length) {
    // Run specific example
    const example = examples[exampleNum - 1];
    console.log(`\nRunning: ${example.name}\n`);
    await example.fn();
  } else {
    // Show menu
    console.log("\nAvailable examples:");
    examples.forEach((ex, i) => {
      console.log(`  ${i + 1}. ${ex.name}`);
    });
    console.log("\nUsage: npm run demo:plan <number>");
    console.log("Example: npm run demo:plan 1");

    // Run first example by default
    console.log("\n[Running Example 1 by default...]\n");
    await examples[0].fn();
  }
}

main().catch(console.error);
