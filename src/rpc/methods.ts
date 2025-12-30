/**
 * Game RPC Method Definitions
 * These methods are called from server to client (Godot)
 * Uses shared operation schemas as source of truth
 */
import { defineMethod } from "../lib/rpc/index.js";
import {
	// Block operations
	listBlocksOperation,
	getBlockOperation,
	searchBlocksOperation,
	createBlockOperation,
	updateBlockOperation,
	deleteBlockOperation,
	// Skill operations
	createSkillOperation,
	updateSkillOperation,
	deleteSkillOperation,
	// Settings operations
	getSettingsOperation,
	getBlockTypesOperation,
	// Plan operations
	submitPlanOperation,
	// Interaction operations
	askUserOperation,
} from "../schemas/index.js";

// ============================================================================
// Query Methods (Read-only)
// ============================================================================

export const listBlocksMethod = defineMethod({
	input: listBlocksOperation.input,
	output: listBlocksOperation.output,
	description: listBlocksOperation.description,
});

export const getBlockMethod = defineMethod({
	input: getBlockOperation.input,
	output: getBlockOperation.output,
	description: getBlockOperation.description,
});

export const searchBlocksMethod = defineMethod({
	input: searchBlocksOperation.input,
	output: searchBlocksOperation.output,
	description: searchBlocksOperation.description,
});

export const getSettingsMethod = defineMethod({
	input: getSettingsOperation.input,
	output: getSettingsOperation.output,
	description: getSettingsOperation.description,
});

export const getBlockTypesMethod = defineMethod({
	input: getBlockTypesOperation.input,
	output: getBlockTypesOperation.output,
	description: getBlockTypesOperation.description,
});

// ============================================================================
// Mutation Methods (Write)
// ============================================================================

export const createBlockMethod = defineMethod({
	input: createBlockOperation.input,
	output: createBlockOperation.output,
	description: createBlockOperation.description,
});

export const updateBlockMethod = defineMethod({
	input: updateBlockOperation.input,
	output: updateBlockOperation.output,
	description: updateBlockOperation.description,
});

export const deleteBlockMethod = defineMethod({
	input: deleteBlockOperation.input,
	output: deleteBlockOperation.output,
	description: deleteBlockOperation.description,
});

export const createSkillMethod = defineMethod({
	input: createSkillOperation.input,
	output: createSkillOperation.output,
	description: createSkillOperation.description,
});

export const updateSkillMethod = defineMethod({
	input: updateSkillOperation.input,
	output: updateSkillOperation.output,
	description: updateSkillOperation.description,
});

export const deleteSkillMethod = defineMethod({
	input: deleteSkillOperation.input,
	output: deleteSkillOperation.output,
	description: deleteSkillOperation.description,
});

export const submitPlanMethod = defineMethod({
	input: submitPlanOperation.input,
	output: submitPlanOperation.output,
	description: submitPlanOperation.description,
});

// ============================================================================
// Interaction Methods
// ============================================================================

export const askUserMethod = defineMethod({
	input: askUserOperation.input,
	output: askUserOperation.output,
	description: askUserOperation.description,
});

// ============================================================================
// Method Registry
// ============================================================================

/**
 * All game RPC methods
 * Server calls these methods on the client
 */
export const GameRpcMethods = {
	// Query
	[listBlocksOperation.rpcMethod]: listBlocksMethod,
	[getBlockOperation.rpcMethod]: getBlockMethod,
	[searchBlocksOperation.rpcMethod]: searchBlocksMethod,
	[getSettingsOperation.rpcMethod]: getSettingsMethod,
	[getBlockTypesOperation.rpcMethod]: getBlockTypesMethod,
	// Block mutations
	[createBlockOperation.rpcMethod]: createBlockMethod,
	[updateBlockOperation.rpcMethod]: updateBlockMethod,
	[deleteBlockOperation.rpcMethod]: deleteBlockMethod,
	// Skill mutations
	[createSkillOperation.rpcMethod]: createSkillMethod,
	[updateSkillOperation.rpcMethod]: updateSkillMethod,
	[deleteSkillOperation.rpcMethod]: deleteSkillMethod,
	// Plan
	[submitPlanOperation.rpcMethod]: submitPlanMethod,
	// Interaction
	[askUserOperation.rpcMethod]: askUserMethod,
} as const;

export type GameRpcMethodRegistry = typeof GameRpcMethods;

// ============================================================================
// Method Names (for type-safe access)
// ============================================================================

export const RPC_METHODS = {
	// Query
	LIST_BLOCKS: listBlocksOperation.rpcMethod,
	GET_BLOCK: getBlockOperation.rpcMethod,
	SEARCH_BLOCKS: searchBlocksOperation.rpcMethod,
	GET_SETTINGS: getSettingsOperation.rpcMethod,
	GET_BLOCK_TYPES: getBlockTypesOperation.rpcMethod,
	// Block mutations
	CREATE_BLOCK: createBlockOperation.rpcMethod,
	UPDATE_BLOCK: updateBlockOperation.rpcMethod,
	DELETE_BLOCK: deleteBlockOperation.rpcMethod,
	// Skill mutations
	CREATE_SKILL: createSkillOperation.rpcMethod,
	UPDATE_SKILL: updateSkillOperation.rpcMethod,
	DELETE_SKILL: deleteSkillOperation.rpcMethod,
	// Plan
	SUBMIT_PLAN: submitPlanOperation.rpcMethod,
	// Interaction
	ASK_USER: askUserOperation.rpcMethod,
} as const;
