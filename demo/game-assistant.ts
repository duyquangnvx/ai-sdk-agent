import "dotenv/config";
import * as readline from "node:readline";
import { PlanAgent, createTool, Memory } from "@voltagent/core";
import { LibSQLMemoryAdapter } from "@voltagent/libsql";
import { createPinoLogger } from "@voltagent/logger";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { z } from "zod";

// ============================================================================
// LOGGER & MEMORY CONFIGURATION
// ============================================================================

const logger = createPinoLogger({
  name: "game-assistant",
  level: "warn",
});

const memory = new Memory({
  storage: new LibSQLMemoryAdapter({
    url: "file:./.voltagent/game-memory.db",
    logger: logger.child({ component: "game-memory" }),
  }),
});

const SESSION = {
  userId: "player-1",
  conversationId: `game-session-${Date.now()}`,
};

// ============================================================================
// MOCK DATABASE - Game Blocks Storage
// ============================================================================

interface GameBlock {
  id: string;
  type: string;
  position: { x: number; y: number; z: number };
  properties: Record<string, unknown>;
  createdAt: Date;
}

const gameBlocks: Map<string, GameBlock> = new Map();

function generateBlockId(): string {
  return `block_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

// ============================================================================
// BLOCK CRUD TOOLS
// ============================================================================

const createBlockTool = createTool({
  name: "create_block",
  description: "Create a new block in the game world",
  parameters: z.object({
    type: z.string().describe("Type of block (grass, stone, wood, water, sand, goal, tee, obstacle, etc.)"),
    x: z.number().describe("X coordinate"),
    y: z.number().describe("Y coordinate"),
    z: z.number().default(0).describe("Z coordinate (height)"),
  }),
  execute: async ({ type, x, y, z }) => {
    const id = generateBlockId();
    const block: GameBlock = {
      id,
      type,
      position: { x, y, z: z ?? 0 },
      properties: {},
      createdAt: new Date(),
    };
    gameBlocks.set(id, block);
    console.log(`  [CREATE] Block "${type}" at (${x}, ${y}, ${z ?? 0})`);
    return { success: true, blockId: id, type, position: block.position };
  },
});

const listBlocksTool = createTool({
  name: "list_blocks",
  description: "List all blocks in the game world",
  parameters: z.object({
    type: z.string().optional().describe("Filter by block type"),
  }),
  execute: async ({ type }) => {
    let blocks = Array.from(gameBlocks.values());
    if (type) blocks = blocks.filter((b) => b.type === type);
    return {
      success: true,
      count: blocks.length,
      blocks: blocks.map((b) => ({ id: b.id, type: b.type, position: b.position })),
    };
  },
});

const deleteBlockTool = createTool({
  name: "delete_block",
  description: "Delete a block from the game world",
  parameters: z.object({
    blockId: z.string().describe("The ID of the block to delete"),
  }),
  execute: async ({ blockId }) => {
    const existed = gameBlocks.delete(blockId);
    console.log(`  [DELETE] Block ${blockId}: ${existed ? "deleted" : "not found"}`);
    return { success: existed };
  },
});

// ============================================================================
// PLAN APPROVAL TOOL - This is the key tool for approval flow
// ============================================================================

const TodoSchema = z.object({
  id: z.string(),
  description: z.string(),
});

const requestBuildApprovalTool = createTool({
  name: "request_build_approval",
  description: `Submit a building plan for user approval.
IMPORTANT: After calling this tool, you MUST STOP and WAIT. Do NOT proceed with building until user explicitly approves.
This tool returns a pending status - the user will approve or reject via the UI.`,
  parameters: z.object({
    projectName: z.string().describe("Name of the project (e.g., 'Racing Game', 'Golf Course')"),
    planSummary: z.string().describe("Brief summary of what will be built"),
    todos: z.array(TodoSchema).describe("List of planned steps from write_todos"),
    estimatedBlocks: z.number().describe("Estimated total number of blocks to create"),
  }),
  execute: async ({ projectName, planSummary, todos, estimatedBlocks }) => {
    // This tool just registers the plan for approval - doesn't execute anything
    // The CLI will intercept this and show approval UI
    return {
      status: "pending_approval",
      projectName,
      planSummary,
      todos,
      estimatedBlocks,
      message: `Plan submitted for approval. Waiting for user response. DO NOT proceed until user approves.`,
      instruction: "STOP HERE. Wait for user to approve or reject. Do not call any other tools.",
    };
  },
});

// ============================================================================
// GAME ASSISTANT AGENT
// ============================================================================

const blockTools = [
  createBlockTool,
  listBlocksTool,
  deleteBlockTool,
  requestBuildApprovalTool,
];

const openai = createOpenAICompatible({
  apiKey: process.env.OPENAI_API_KEY || "",
  baseURL: "https://litellm.zingplay.com/v1",
  name: "litellm",
});

const gameAssistantAgent = new PlanAgent({
  name: "GameAssistant",
  systemPrompt: `You are a friendly Game Assistant that helps players build things in a block-based game world.

## Behavior Rules:

### 1. Casual conversation (greetings, questions, chitchat):
- Respond naturally WITHOUT using any tools
- Examples: "Xin chào", "Hello!", "Bạn là ai?"

### 2. Simple operations (1-3 blocks):
- Use create_block directly for each block
- Execute immediately without asking for approval
- Examples: "Tạo 1 block gỗ", "Create 2 stone blocks"

### 3. Complex projects (4+ blocks, structures, mini-games):
- Step 1: Create a DETAILED plan using write_todos with SPECIFIC steps like:
  - "Create tee area: 1 tee block at (0, 0)"
  - "Create fairway: 8 grass blocks from (1,0) to (8,0)"
  - "Add water hazard: 4 water blocks at (4,2) to (4,5)"
  - "Create hole: 1 hole block at (10,0) with 1 flag block at (10,0,1)"
  - Each step should specify: block type, quantity, and positions
- Step 2: IMMEDIATELY call request_build_approval tool with:
  - projectName: name of the project
  - planSummary: brief description
  - todos: the DETAILED plan steps (NOT generic steps like "build the game")
  - estimatedBlocks: total number of blocks
- Step 3: WAIT for approval (do NOT proceed until approved)
- Step 4: After approval, execute EXACTLY as planned using create_block

## IMPORTANT:
- For complex projects, you MUST call request_build_approval AFTER write_todos
- Do NOT ask for approval via text - use the tool instead
- The approval tool will handle the user interaction

## Block Types:
grass, stone, wood, water, sand, brick, glass, metal, goal, tee, obstacle, flag, hole, wall, floor, roof

## Response Language:
- Respond in the same language the user uses`,
  model: openai("local-model"),
  tools: blockTools,
  memory,
  planning: {
    systemPrompt: `For complex projects:
1. Create detailed plan with write_todos
2. Call request_build_approval immediately after
3. Wait for approval before building`,
  },
});

// ============================================================================
// CLI WITH APPROVAL HANDLING
// ============================================================================

interface PendingApproval {
  toolCallId: string;
  toolName: string;
  args: {
    projectName?: string;
    planSummary?: string;
    todos?: Array<{ id: string; description: string }>;
    estimatedBlocks?: number;
  };
}

let pendingApproval: PendingApproval | null = null;
let rl: readline.Interface;

function displayApprovalRequest(approval: PendingApproval): void {
  const { projectName, planSummary, todos, estimatedBlocks } = approval.args;

  console.log("\n");
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║                   🔔 APPROVAL REQUIRED                      ║");
  console.log("╠════════════════════════════════════════════════════════════╣");
  console.log(`║  Project: ${(projectName || "Unknown").padEnd(48)}║`);
  console.log(`║  Summary: ${(planSummary || "").slice(0, 48).padEnd(48)}║`);
  console.log(`║  Estimated Blocks: ${(estimatedBlocks?.toString() || "?").padEnd(39)}║`);
  console.log("╠════════════════════════════════════════════════════════════╣");
  console.log("║  Plan Steps:                                                ║");

  if (todos && todos.length > 0) {
    for (const todo of todos.slice(0, 6)) {
      const desc = todo.description.slice(0, 54);
      console.log(`║    • ${desc.padEnd(52)}║`);
    }
    if (todos.length > 6) {
      console.log(`║    ... and ${todos.length - 6} more steps`.padEnd(61) + "║");
    }
  }

  console.log("╠════════════════════════════════════════════════════════════╣");
  console.log("║  Type 'approve' to proceed or 'reject' to cancel           ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
}

async function processApproval(approved: boolean): Promise<string> {
  if (!pendingApproval) {
    return "No pending approval request.";
  }

  const approval = pendingApproval;
  pendingApproval = null;

  if (approved) {
    console.log("\n✅ [APPROVED] Executing plan...\n");

    // Tell agent to proceed with the approved plan
    const result = await gameAssistantAgent.generateText(
      `The user has APPROVED the plan for "${approval.args.projectName}".
Now execute the plan step by step using create_block for each component.
Build all the blocks as planned.`,
      {
        userId: SESSION.userId,
        conversationId: SESSION.conversationId,
        maxSteps: 50,
      }
    );

    return result.text || "Plan executed!";
  } else {
    console.log("\n❌ [REJECTED] Plan cancelled.\n");
    return "Plan rejected. Let me know if you'd like to try something different!";
  }
}

async function chat(userMessage: string): Promise<string> {
  // Check if this is an approval response
  const lowerMsg = userMessage.toLowerCase().trim();

  if (pendingApproval) {
    if (["approve", "yes", "ok", "y", "đồng ý", "duyệt"].includes(lowerMsg)) {
      return processApproval(true);
    }
    if (["reject", "no", "n", "cancel", "từ chối", "hủy"].includes(lowerMsg)) {
      return processApproval(false);
    }
    // Not an approval command, remind user
    return "⏳ There's a pending approval request. Please type 'approve' or 'reject'.";
  }

  // Normal chat - use generateText
  const result = await gameAssistantAgent.generateText(userMessage, {
    userId: SESSION.userId,
    conversationId: SESSION.conversationId,
    maxSteps: 30,
  });

  // Check if there's an approval request in tool results
  if (result.toolResults) {
    for (const toolResult of result.toolResults) {
      if (toolResult.toolName === "request_build_approval") {
        // Get the output from the tool
        const output = toolResult.output as {
          status?: string;
          projectName?: string;
          planSummary?: string;
          todos?: Array<{ id: string; description: string }>;
          estimatedBlocks?: number;
        };

        if (output?.status === "pending_approval") {
          // Save pending approval and display UI
          pendingApproval = {
            toolCallId: toolResult.toolCallId,
            toolName: toolResult.toolName,
            args: {
              projectName: output.projectName,
              planSummary: output.planSummary,
              todos: output.todos,
              estimatedBlocks: output.estimatedBlocks,
            },
          };

          displayApprovalRequest(pendingApproval);
          return ""; // Don't print additional text, approval UI is shown
        }
      }
    }
  }

  return result.text || "(No response)";
}

async function showStatus(): Promise<void> {
  const blocks = Array.from(gameBlocks.values());
  console.log("\n╔════════════════════════════════════════╗");
  console.log("║           GAME WORLD STATUS            ║");
  console.log("╠════════════════════════════════════════╣");
  console.log(`║  Total Blocks: ${blocks.length.toString().padEnd(24)}║`);

  if (blocks.length > 0) {
    const types = new Map<string, number>();
    for (const block of blocks) {
      types.set(block.type, (types.get(block.type) || 0) + 1);
    }
    console.log("╠────────────────────────────────────────╣");
    for (const [type, count] of types) {
      console.log(`║  ${type}: ${count.toString().padEnd(29)}║`);
    }
  }
  console.log("╚════════════════════════════════════════╝\n");
}

async function main(): Promise<void> {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║              GAME ASSISTANT - Block Builder                ║");
  console.log("╠════════════════════════════════════════════════════════════╣");
  console.log("║  Commands:                                                  ║");
  console.log("║    /status  - Show game world status                       ║");
  console.log("║    /clear   - Clear all blocks                             ║");
  console.log("║    /exit    - Exit the assistant                           ║");
  console.log("║                                                             ║");
  console.log("║  Examples:                                                  ║");
  console.log("║    - Chat: 'Hello!', 'Xin chào'                            ║");
  console.log("║    - Simple: 'Tạo 1 block gỗ' (immediate)                  ║");
  console.log("║    - Complex: 'Làm game đua xe' (requires approval)        ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log(`\n[Session] ${SESSION.conversationId}\n`);

  rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const prompt = (): void => {
    const promptText = pendingApproval ? "Approve? " : "You: ";

    rl.question(promptText, async (input) => {
      const trimmed = input.trim();

      if (!trimmed) {
        prompt();
        return;
      }

      // Handle commands
      if (trimmed === "/exit" || trimmed === "/quit") {
        console.log("\nGoodbye! 👋\n");
        rl.close();
        process.exit(0);
      }

      if (trimmed === "/status") {
        await showStatus();
        prompt();
        return;
      }

      if (trimmed === "/clear") {
        gameBlocks.clear();
        pendingApproval = null;
        console.log("\n[System] All blocks cleared!\n");
        prompt();
        return;
      }

      try {
        if (!pendingApproval) {
          console.log("\n[Processing...]\n");
        }

        const response = await chat(trimmed);

        if (response) {
          console.log(`🤖 Assistant: ${response}\n`);
        }
      } catch (error) {
        console.error("\n[Error]", error);
      }

      prompt();
    });
  };

  prompt();
}

main().catch(console.error);
