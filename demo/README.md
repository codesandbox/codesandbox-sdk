# CodeSandbox SDK Demo

This is a demo application showcasing the CodeSandbox SDK with an Express server running Vite middleware in a single process.

## Architecture

The demo uses a TypeScript Express server that integrates Vite as middleware, providing:
- **API routes** for backend functionality
- **Vite dev server** for hot module replacement and frontend serving
- **Single process** - no need to run separate frontend/backend servers

## Setup

1. Build the SDK from the root directory:
   ```bash
   npm run build
   ```

2. Install demo dependencies:
   ```bash
   cd demo
   npm install
   ```

3. Run the demo:
   ```bash
   npm run dev
   ```

This will start the server at `http://localhost:3000` with both API routes and the Vite frontend.

## Available Scripts

- `npm run dev` - Start the TypeScript server with Vite middleware
- `npm run build` - Build the frontend for production
- `npm run preview` - Preview production build

## Usage

### Frontend (Vite + React)

The demo app imports the SDK from the local build using:

```typescript
import CodeSandbox from '@codesandbox/sdk'
```

You can modify `src/App.tsx` to add your SDK demo code.

### Backend (Express + Vite Middleware)

The Express server (`server.ts`) provides:

- API routes (mounted before Vite middleware):
  - `GET /api/health` - Health check endpoint
  - `GET /api/example` - Example API endpoint
- Vite middleware for serving the frontend with HMR

Add your custom API routes in `server.ts` before the Vite middleware setup to support your SDK demo needs (like handling API keys, proxying requests, etc.).
