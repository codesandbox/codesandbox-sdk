import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "CodeSandbox SDK",
  description: "The power of CodeSandbox in a library",
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Guides', link: '/guides/getting-started/quick-start' },
      { text: 'API Reference', link: '/api/core-classes/codesandbox' },
      { text: 'CLI', link: '/cli/overview' }
    ],

    sidebar: {
      '/guides/': [
        {
          text: 'Getting Started',
          collapsed: false,
          items: [
            { text: 'Quick Start', link: '/guides/getting-started/quick-start' },
            { text: 'Platform Setup', link: '/guides/getting-started/platform-setup' },
            { text: 'Authentication', link: '/guides/getting-started/authentication' }
          ]
        },
        {
          text: 'Core Concepts',
          collapsed: false,
          items: [
            { text: 'Understanding Sandboxes', link: '/guides/core-concepts/sandboxes' },
            { text: 'Sandbox Lifecycle', link: '/guides/core-concepts/lifecycle' },
            { text: 'VM Tiers & Resources', link: '/guides/core-concepts/vm-tiers' }
          ]
        },
        {
          text: 'SDK Usage',
          collapsed: false,
          items: [
            { text: 'Basic Operations', link: '/guides/sdk-usage/basic-operations' },
            { text: 'File System Operations', link: '/guides/sdk-usage/filesystem' },
            { text: 'Command Execution', link: '/guides/sdk-usage/commands' },
            { text: 'Terminal Management', link: '/guides/sdk-usage/terminals' }
          ]
        },
        {
          text: 'Advanced Features',
          collapsed: false,
          items: [
            { text: 'Port Management', link: '/guides/advanced/ports' },
            { text: 'Source Control', link: '/guides/advanced/git' },
            { text: 'Code Interpretation', link: '/guides/advanced/interpreters' },
            { text: 'Browser Integration', link: '/guides/advanced/browser' }
          ]
        },
        {
          text: 'Use Cases',
          collapsed: false,
          items: [
            { text: 'AI Agents & Code Interpretation', link: '/guides/use-cases/ai-agents' },
            { text: 'Development Environments', link: '/guides/use-cases/dev-environments' },
            { text: 'CI/CD Integration', link: '/guides/use-cases/cicd' },
            { text: 'Educational Platforms', link: '/guides/use-cases/education' }
          ]
        },
        {
          text: 'Best Practices',
          collapsed: false,
          items: [
            { text: 'Performance Optimization', link: '/guides/best-practices/performance' },
            { text: 'Error Handling', link: '/guides/best-practices/error-handling' },
            { text: 'Monitoring & Debugging', link: '/guides/best-practices/monitoring' }
          ]
        }
      ],
      '/api/': [
        {
          text: 'Core Classes',
          collapsed: false,
          items: [
            { text: 'CodeSandbox', link: '/api/core-classes/codesandbox' },
            { text: 'Sandboxes', link: '/api/core-classes/sandboxes' },
            { text: 'Sandbox', link: '/api/core-classes/sandbox' },
            { text: 'SandboxClient', link: '/api/core-classes/sandbox-client' }
          ]
        },
        {
          text: 'SandboxClient APIs',
          collapsed: false,
          items: [
            { text: 'File System', link: '/api/sandbox-client/filesystem' },
            { text: 'Commands', link: '/api/sandbox-client/commands' },
            { text: 'Terminals', link: '/api/sandbox-client/terminals' },
            { text: 'Ports', link: '/api/sandbox-client/ports' },
            { text: 'Tasks', link: '/api/sandbox-client/tasks' },
            { text: 'Interpreters', link: '/api/sandbox-client/interpreters' },
            { text: 'Setup', link: '/api/sandbox-client/setup' }
          ]
        },
        {
          text: 'Browser APIs',
          collapsed: false,
          items: [
            { text: 'Browser Connection', link: '/api/browser/connection' },
            { text: 'Preview Management', link: '/api/browser/previews' }
          ]
        },
        {
          text: 'Host Tokens',
          collapsed: false,
          items: [
            { text: 'HostTokens Class', link: '/api/host-tokens/host-tokens' }
          ]
        },
        {
          text: 'Types & Interfaces',
          collapsed: false,
          items: [
            { text: 'Configuration Types', link: '/api/types/configuration' },
            { text: 'Event Types', link: '/api/types/events' },
            { text: 'Error Types', link: '/api/types/errors' }
          ]
        }
      ],
      '/cli/': [
        {
          text: 'CLI Documentation',
          collapsed: false,
          items: [
            { text: 'Overview', link: '/cli/overview' },
            { text: 'Interactive Mode', link: '/cli/interactive' },
            { text: 'Build Command', link: '/cli/build' },
            { text: 'Sandbox Management', link: '/cli/sandboxes' },
            { text: 'Host Tokens', link: '/cli/host-tokens' }
          ]
        }
      ]
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/codesandbox/codesandbox-sdk' }
    ],

    search: {
      provider: 'local'
    },

    editLink: {
      pattern: 'https://github.com/codesandbox/codesandbox-sdk/edit/main/docs/:path'
    }
  }
})