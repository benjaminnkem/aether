# Aether

**Speak any onchain intent. It simulates, protects, and executes it through KeeperHub.**

Aether is a natural language intent agent that turns human instructions into safe onchain actions — supporting both DeFi strategies and payments.

## What it does

- Parse natural language intents (e.g. "Move 40% of my USDC from Aave to Morpho if Morpho APY is higher and health factor stays above 1.5")
- Create and run KeeperHub workflows via MCP
- Pre-execution simulation + user confirmation
- Real onchain execution with full audit trail
- Natural language status queries ("What's my current position?", "Did the last payment succeed?")

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **UI**: Tailwind CSS + shadcn/ui
- **Agent**: LangChain.js
- **LLM**: Gemini 2.5 Flash
- **Execution**: KeeperHub (MCP)
- **Monorepo**: Turborepo + pnpm

## Getting Started

```bash
# Install dependencies
pnpm install

# Run the development server
pnpm --filter web dev
```
