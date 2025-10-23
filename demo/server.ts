import express from "express";
import { createServer as createViteServer } from "vite";
import { CodeSandbox } from "@codesandbox/sdk";

const app = express();
const PORT = process.env.PORT || 3000;
const sdk = new CodeSandbox();

async function startServer() {
  // Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.post("/api/sandboxes", async (_req, res) => {
    const sandbox = await sdk.sandboxes.create();
    const session = await sandbox.createSession();

    res.json(session);
  });

  app.get("/api/sandboxes/:id", async (req, res) => {
    const sandbox = await sdk.sandboxes.resume(req.params.id);
    const session = await sandbox.createSession();

    res.json(session);
  });

  // Create Vite server in middleware mode
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });

  // Use Vite's connect instance as middleware
  app.use(vite.middlewares);

  // Start server
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`API available at http://localhost:${PORT}/api`);
  });
}

startServer();
