# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Build Commands
- `npm run build` - Full production build (clean, esbuild, generate types for both CJS and ESM)
- `npm run build:esbuild` - Run esbuild bundling only
- `npm run clean` - Remove dist directory
- `npm run dev:cli` - Development mode with file watching for CLI (watches src/bin)

### Type Checking and Linting
- `npm run typecheck` - Run TypeScript type checking without emitting files
- `npm run format` - Format code using Prettier

### CLI Development
- `npm run dev:cli` - Start development mode with file watching specifically for CLI changes
- The CLI binary is built to `dist/bin/codesandbox.mjs` and made executable
- CLI can be run with `./dist/bin/codesandbox.mjs` or just `csb` if installed globally

### API Client Generation
- `npm run build-openapi` - Generate API clients from production OpenAPI spec
- `npm run build-openapi:staging` - Generate API clients from staging OpenAPI spec
- Generated clients are placed in `src/api-clients/` directory

## Architecture

### Core Components

**SDK Entry Points:**
- `src/index.ts` - Main SDK export with `CodeSandbox` class
- `src/browser/index.ts` - Browser-specific SDK build
- `src/node/index.ts` - Node.js-specific SDK build

**Key Classes:**
- `CodeSandbox` - Main SDK class providing `sandboxes` and `hosts` properties
- `Sandboxes` (src/Sandboxes.ts) - Manages sandbox operations (create, list, get, fork)  
- `Sandbox` (src/Sandbox.ts) - Individual sandbox instance with connection and session management
- `SandboxClient` (src/SandboxClient/index.ts) - High-level client for sandbox interactions
- `API` (src/API.ts) - Low-level API wrapper for all CodeSandbox REST endpoints

**Communication Layer:**
- `src/pitcher-protocol/` - WebSocket protocol definitions and message types for real-time sandbox communication
- `src/AgentClient/` - WebSocket client implementation for connecting to sandbox agents

**CLI:**
- `src/bin/main.tsx` - CLI entry point using Ink (React for CLI)
- `src/bin/commands/` - Individual CLI commands (build, sandbox, previewHosts, hostTokens)
- `src/bin/ui/` - Ink-based UI components for the interactive CLI

### Build System

**Multi-Format Output:**
- ESM build: `dist/esm/` (primary format, "type": "module")
- CommonJS build: `dist/cjs/` (compatibility)
- Browser build: Separate bundles with browser polyfills
- CLI build: Standalone executable with shebang

**Key Build Features:**
- esbuild for bundling with custom plugins for module replacement
- Separate TypeScript compilation for type definitions
- Browser polyfills for Node.js modules (os, path, crypto, etc.)
- External dependencies preserved except for CLI build which bundles React/Ink

### Type System

**Configuration:**
- Main tsconfig.json excludes `src/bin` and `src/api-clients` 
- Separate build configs for CJS (`tsconfig.build-cjs.json`) and ESM (`tsconfig.build-esm.json`)
- Strict TypeScript configuration with comprehensive type checking

**Generated Types:**
- `src/api-clients/` contains auto-generated API clients and types from OpenAPI specs
- Multiple API client modules for different sandbox services (fs, git, shell, etc.)

### Authentication & Configuration

**API Authentication:**
- Requires CodeSandbox API token (CSB_API_KEY environment variable)
- Token creation: https://codesandbox.io/t/api
- Automatic User-Agent header injection with SDK version

**Environment Detection:**
- Automatic base URL inference based on API key format
- Support for different CodeSandbox environments (production, staging)

### Testing

The codebase includes a `test-template/` directory with a Vite + React + TypeScript template for SDK testing.

## Documentation

**SDK Documentation:** https://codesandbox.io/docs/sdk

**Contributing to Documentation:** 
- Documentation source is located at https://github.com/codesandbox/docs
- SDK-specific docs are in `packages/projects-docs/pages/sdk/` folder
- Update documentation there when making changes to SDK functionality

## Key Patterns

**Error Handling:**
- `handleResponse` utility for consistent API error handling
- Retry logic with exponential backoff for critical operations
- OpenTelemetry tracing integration for observability

**Session Management:**
- Support for custom sessions with git credentials and environment variables
- Browser session creation for web-based sandbox interactions
- Automatic session cleanup and disposal

**Resource Management:**
- VM tier scaling and hibernation timeout management  
- Cluster and bootup type tracking
- Agent version management and update detection