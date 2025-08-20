# AI Agents & Code Interpretation

Learn how to use CodeSandbox SDK for AI agents and safe code interpretation scenarios.

## Overview

The CodeSandbox SDK is perfect for AI applications that need to execute code safely:

- **Isolated execution** - Run untrusted code without security risks
- **Multiple languages** - Support Python, Node.js, and more
- **Resource limits** - Control CPU, memory, and execution time
- **Output capture** - Get stdout, stderr, and file outputs
- **Persistent state** - Maintain context between executions

## Basic Code Interpretation

### Simple Code Execution

```javascript
import { CodeSandbox } from "@codesandbox/sdk";

const sdk = new CodeSandbox(process.env.CSB_API_KEY);

async function executeCode(code, language = "python") {
  // Create a sandbox for code execution
  const sandbox = await sdk.sandboxes.create({
    title: "Code Interpreter",
    tags: ["ai", "code-execution"]
  });

  try {
    const client = await sandbox.connect();
    
    // Execute the code
    const result = await client.commands.run(`${language} -c "${code}"`);
    
    return {
      output: result.output,
      error: result.error,
      exitCode: result.exitCode
    };
  } finally {
    // Clean up
    await sandbox.shutdown();
  }
}

// Example usage
const pythonCode = `
print("Hello from AI agent!")
import math
result = math.sqrt(16)
print(f"Square root of 16 is: {result}")
`;

const result = await executeCode(pythonCode, "python3");
console.log(result.output);
```

### Advanced Code Interpretation

```javascript
class CodeInterpreter {
  constructor(apiKey) {
    this.sdk = new CodeSandbox(apiKey);
    this.sandbox = null;
    this.client = null;
  }

  async initialize() {
    // Create a persistent sandbox for the session
    this.sandbox = await this.sdk.sandboxes.create({
      title: "AI Code Interpreter Session",
      tags: ["ai", "persistent"],
      vmTier: "SMALL" // More resources for complex operations
    });

    this.client = await this.sandbox.connect();
    
    // Install common packages
    await this.client.commands.run("pip install numpy pandas matplotlib requests", {
      cwd: "/project"
    });
  }

  async executeCode(code, language = "python3") {
    if (!this.client) {
      await this.initialize();
    }

    try {
      // Write code to a file for better error handling
      const filename = `code_${Date.now()}.py`;
      await this.client.fs.writeFile(`/project/${filename}`, code);

      // Execute the code
      const result = await this.client.commands.run(`${language} ${filename}`, {
        cwd: "/project",
        timeout: 30000 // 30 second timeout
      });

      // Clean up the file
      await this.client.fs.deleteFile(`/project/${filename}`);

      return {
        success: result.exitCode === 0,
        output: result.output,
        error: result.error,
        exitCode: result.exitCode
      };
    } catch (error) {
      return {
        success: false,
        output: "",
        error: error.message,
        exitCode: -1
      };
    }
  }

  async installPackage(packageName, language = "python") {
    const commands = {
      python: `pip install ${packageName}`,
      node: `npm install ${packageName}`,
      rust: `cargo add ${packageName}`
    };

    const command = commands[language];
    if (!command) {
      throw new Error(`Unsupported language: ${language}`);
    }

    return await this.client.commands.run(command, { cwd: "/project" });
  }

  async getFileContent(path) {
    return await this.client.fs.readFile(path);
  }

  async saveFile(path, content) {
    return await this.client.fs.writeFile(path, content);
  }

  async cleanup() {
    if (this.client) {
      await this.client.disconnect();
    }
    if (this.sandbox) {
      await this.sandbox.shutdown();
    }
  }
}
```

## AI Agent Integration

### OpenAI Integration Example

```javascript
import OpenAI from "openai";
import { CodeSandbox } from "@codesandbox/sdk";

class AICodeAgent {
  constructor(openaiKey, csbKey) {
    this.openai = new OpenAI({ apiKey: openaiKey });
    this.interpreter = new CodeInterpreter(csbKey);
  }

  async processQuery(userQuery) {
    // Get code from AI
    const response = await this.openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that writes Python code to solve problems. Only return the code, no explanations."
        },
        {
          role: "user",
          content: userQuery
        }
      ]
    });

    const code = response.choices[0].message.content;
    
    // Execute the code safely
    const result = await this.interpreter.executeCode(code);
    
    if (result.success) {
      return {
        code: code,
        output: result.output,
        success: true
      };
    } else {
      // Try to fix the error with AI
      const fixResponse = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "Fix the following Python code based on the error message. Only return the corrected code."
          },
          {
            role: "user",
            content: `Code: ${code}\nError: ${result.error}`
          }
        ]
      });

      const fixedCode = fixResponse.choices[0].message.content;
      const fixedResult = await this.interpreter.executeCode(fixedCode);
      
      return {
        code: fixedCode,
        output: fixedResult.output,
        success: fixedResult.success,
        wasFixed: true
      };
    }
  }

  async cleanup() {
    await this.interpreter.cleanup();
  }
}

// Usage
const agent = new AICodeAgent(process.env.OPENAI_API_KEY, process.env.CSB_API_KEY);

const result = await agent.processQuery(
  "Create a bar chart showing the population of the top 5 most populous countries"
);

console.log("Generated code:", result.code);
console.log("Output:", result.output);

await agent.cleanup();
```

## Data Analysis Workflows

### Jupyter-like Environment

```javascript
class DataAnalysisEnvironment {
  constructor(apiKey) {
    this.sdk = new CodeSandbox(apiKey);
    this.sandbox = null;
    this.client = null;
    this.cellHistory = [];
  }

  async initialize() {
    this.sandbox = await this.sdk.sandboxes.create({
      title: "Data Analysis Environment",
      tags: ["data-science", "jupyter"],
      vmTier: "MEDIUM" // More resources for data processing
    });

    this.client = await this.sandbox.connect();

    // Install data science packages
    await this.client.commands.run(`
      pip install pandas numpy matplotlib seaborn jupyter plotly scikit-learn
    `, { cwd: "/project" });

    // Set up matplotlib for non-interactive use
    await this.executeCell(`
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import pandas as pd
import numpy as np
    `);
  }

  async executeCell(code) {
    const cellId = this.cellHistory.length;
    const filename = `cell_${cellId}.py`;

    try {
      // Add cell to history
      this.cellHistory.push({ code, filename, timestamp: new Date() });

      // Write code to file
      await this.client.fs.writeFile(`/project/${filename}`, code);

      // Execute
      const result = await this.client.commands.run(`python ${filename}`, {
        cwd: "/project"
      });

      // Check for generated plots
      const plotFiles = await this.findGeneratedPlots();

      return {
        cellId,
        success: result.exitCode === 0,
        output: result.output,
        error: result.error,
        plots: plotFiles
      };
    } catch (error) {
      return {
        cellId,
        success: false,
        output: "",
        error: error.message,
        plots: []
      };
    }
  }

  async findGeneratedPlots() {
    try {
      const files = await this.client.fs.readDir("/project");
      return files.filter(file => 
        file.endsWith('.png') || 
        file.endsWith('.jpg') || 
        file.endsWith('.svg')
      );
    } catch {
      return [];
    }
  }

  async getPlot(filename) {
    return await this.client.fs.readFile(`/project/${filename}`);
  }

  async uploadDataset(filename, data) {
    await this.client.fs.writeFile(`/project/${filename}`, data);
  }

  async getCellHistory() {
    return this.cellHistory;
  }
}
```

## Security Best Practices

### Resource Limits

```javascript
async function executeWithLimits(code) {
  const sandbox = await sdk.sandboxes.create({
    title: "Limited Execution",
    vmTier: "NANO", // Minimal resources
    tags: ["restricted"]
  });

  const client = await sandbox.connect();

  try {
    // Set execution limits
    const result = await client.commands.run(`
      timeout 30s python3 -c "${code}"
    `, {
      cwd: "/project",
      timeout: 35000, // SDK timeout slightly higher than command timeout
      env: {
        PYTHONPATH: "/project",
        // Restrict network access if needed
        no_proxy: "*"
      }
    });

    return result;
  } finally {
    // Always clean up
    await client.disconnect();
    await sandbox.shutdown();
  }
}
```

### Input Sanitization

```javascript
function sanitizeCode(code) {
  // Remove potentially dangerous operations
  const dangerous = [
    'import os',
    'import subprocess',
    'import sys',
    '__import__',
    'exec(',
    'eval(',
    'open(',
    'file(',
    'input(',
    'raw_input('
  ];

  for (const danger of dangerous) {
    if (code.includes(danger)) {
      throw new Error(`Potentially dangerous operation detected: ${danger}`);
    }
  }

  return code;
}

async function safeExecute(code) {
  const sanitized = sanitizeCode(code);
  return await executeCode(sanitized);
}
```

## Error Recovery and Debugging

### Robust Execution

```javascript
class RobustCodeExecutor {
  constructor(apiKey) {
    this.sdk = new CodeSandbox(apiKey);
    this.maxRetries = 3;
  }

  async executeWithRetry(code, language = "python3") {
    let lastError;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const sandbox = await this.sdk.sandboxes.create({
          title: `Execution Attempt ${attempt}`,
          tags: ["retry", `attempt-${attempt}`]
        });

        const client = await sandbox.connect();

        try {
          const result = await client.commands.run(`${language} -c "${code}"`, {
            timeout: 30000
          });

          // Success - clean up and return
          await client.disconnect();
          await sandbox.shutdown();
          
          return {
            success: true,
            output: result.output,
            attempt: attempt
          };
        } finally {
          await client.disconnect();
          await sandbox.shutdown();
        }
      } catch (error) {
        lastError = error;
        console.log(`Attempt ${attempt} failed:`, error.message);
        
        if (attempt < this.maxRetries) {
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }

    return {
      success: false,
      error: lastError.message,
      attempts: this.maxRetries
    };
  }
}
```

## Performance Optimization

### Sandbox Pooling

```javascript
class SandboxPool {
  constructor(apiKey, poolSize = 3) {
    this.sdk = new CodeSandbox(apiKey);
    this.pool = [];
    this.poolSize = poolSize;
    this.busy = new Set();
  }

  async initialize() {
    // Pre-create sandboxes
    for (let i = 0; i < this.poolSize; i++) {
      const sandbox = await this.sdk.sandboxes.create({
        title: `Pool Sandbox ${i}`,
        tags: ["pool", "reusable"]
      });
      
      const client = await sandbox.connect();
      
      // Pre-install common packages
      await client.commands.run("pip install numpy pandas matplotlib");
      
      this.pool.push({ sandbox, client });
    }
  }

  async execute(code) {
    // Get available sandbox
    const available = this.pool.find(item => !this.busy.has(item));
    
    if (!available) {
      throw new Error("No available sandboxes in pool");
    }

    this.busy.add(available);

    try {
      const result = await available.client.commands.run(`python3 -c "${code}"`);
      return result;
    } finally {
      this.busy.delete(available);
    }
  }

  async cleanup() {
    for (const { client, sandbox } of this.pool) {
      await client.disconnect();
      await sandbox.shutdown();
    }
    this.pool = [];
    this.busy.clear();
  }
}
```

## Next Steps

- Explore [Development Environments](/guides/use-cases/dev-environments) for persistent coding environments
- Learn about [CI/CD Integration](/guides/use-cases/cicd) for automated testing
- Check out [Performance Optimization](/guides/best-practices/performance) best practices
- See [Error Handling](/guides/best-practices/error-handling) for robust applications
