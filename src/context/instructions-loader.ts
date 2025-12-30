import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve } from 'path';
import type { InstructionsLoader } from '../types/agent.types.js';

/**
 * Helper functions for loading agent instructions
 * Similar to how Claude Code loads CLAUDE.md files
 */
export const InstructionsLoaderUtils = {
  /**
   * Load instructions from a file
   */
  fromFile(filePath: string): InstructionsLoader {
    return async () => {
      const resolvedPath = resolve(filePath);
      if (!existsSync(resolvedPath)) {
        throw new Error(`Instructions file not found: ${resolvedPath}`);
      }
      return readFile(resolvedPath, 'utf-8');
    };
  },

  /**
   * Load instructions from multiple files and concatenate
   */
  fromFiles(filePaths: string[], separator: string = '\n\n'): InstructionsLoader {
    return async () => {
      const contents: string[] = [];
      for (const filePath of filePaths) {
        const resolvedPath = resolve(filePath);
        if (existsSync(resolvedPath)) {
          const content = await readFile(resolvedPath, 'utf-8');
          contents.push(content);
        }
      }
      return contents.join(separator);
    };
  },

  /**
   * Load instructions from file if exists, otherwise return default
   */
  fromFileOrDefault(filePath: string, defaultInstructions: string): InstructionsLoader {
    return async () => {
      const resolvedPath = resolve(filePath);
      if (existsSync(resolvedPath)) {
        return readFile(resolvedPath, 'utf-8');
      }
      return defaultInstructions;
    };
  },

  /**
   * Load instructions from a URL
   */
  fromUrl(url: string): InstructionsLoader {
    return async () => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch instructions from ${url}: ${response.statusText}`);
      }
      return response.text();
    };
  },

  /**
   * Combine multiple instruction loaders
   */
  combine(loaders: InstructionsLoader[], separator: string = '\n\n'): InstructionsLoader {
    return async () => {
      const results = await Promise.all(
        loaders.map((loader) => (typeof loader === 'function' ? loader() : loader))
      );
      return results.join(separator);
    };
  },

  /**
   * Create a conditional loader
   */
  conditional(
    condition: () => boolean | Promise<boolean>,
    ifTrue: InstructionsLoader,
    ifFalse: InstructionsLoader = () => ''
  ): InstructionsLoader {
    return async () => {
      const shouldUseTrue = await condition();
      const loader = shouldUseTrue ? ifTrue : ifFalse;
      return typeof loader === 'function' ? loader() : loader;
    };
  },

  /**
   * Create a template-based loader
   */
  template(template: string, variables: Record<string, string | (() => string | Promise<string>)>): InstructionsLoader {
    return async () => {
      let result = template;
      for (const [key, value] of Object.entries(variables)) {
        const resolved = typeof value === 'function' ? await value() : value;
        result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), resolved);
      }
      return result;
    };
  },
};

/**
 * Default instruction file names to search for
 */
export const DEFAULT_INSTRUCTION_FILES = [
  'INSTRUCTIONS.md',
  'AGENT.md',
  '.agent/instructions.md',
  '.agent/INSTRUCTIONS.md',
];

/**
 * Auto-discover and load instructions from common locations
 */
export function autoLoadInstructions(basePath: string = process.cwd()): InstructionsLoader {
  return async () => {
    for (const fileName of DEFAULT_INSTRUCTION_FILES) {
      const filePath = resolve(basePath, fileName);
      if (existsSync(filePath)) {
        return readFile(filePath, 'utf-8');
      }
    }
    return ''; // No instructions found
  };
}
