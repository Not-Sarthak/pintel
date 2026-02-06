# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**pintel** is a multimodal AI evaluation game frontend. Built for the Vercel AI Gateway Hackathon.

## Commands

```bash
bun dev          # Start development server with Turbopack
bun build        # Build for production
bun start        # Start production server
bun lint         # Run ESLint
```

## Architecture

### Tech Stack
- **Framework**: Next.js 15 (App Router)
- **UI**: Tailwind CSS v4, Radix UI primitives
- **Animation**: Motion (Framer Motion), Lottie
- **Language**: TypeScript, React 19

### Key Directories

```
app/
├── page.tsx                  # Home page
├── play/page.tsx             # Play page
├── layout.tsx                # Root layout
components/
├── ui/                       # UI primitives (button)
├── logos/                    # Logo components
├── providers/                # Context providers
lib/
├── utils.ts                  # Utility functions
├── grid-patterns.ts          # CSS grid patterns
hooks/
├── use-theme.ts              # Theme hook
├── use-sound.ts              # Sound effects hook
stores/
├── theme.ts                  # Theme state (zustand)
```

## Environment Variables

```
# No environment variables required for basic operation
```
