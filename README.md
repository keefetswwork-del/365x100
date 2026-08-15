# 365 × 100

A private, browser-local daily writing practice built with Next.js, TypeScript,
and Tailwind CSS.

## Commands

```bash
npm run dev
npm run lint
npm run typecheck
npm run test:unit
npm run test:e2e
npm test
npm run build
```

Install Playwright's Chromium browser once before running the end-to-end test:

```bash
npx playwright install chromium
```

Build 1 stores each anonymous draft only in browser `localStorage`, using a key
in the form `365x100:entry:YYYY-MM-DD`.
