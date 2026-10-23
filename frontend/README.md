This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Route Feature Tests

From this directory, install frontend dependencies and the Playwright Chromium
browser once:

```bash
npm ci
npm run test:route:install-browser
```

The route test command runs the backend regression suite, frontend helper
checks, deterministic Planner/Oracle browser tests, TypeScript validation, and
focused ESLint checks. Its backend runner automatically uses `backend/.venv`
when available, or falls back to Python on `PATH`; the selected interpreter
must have the backend requirements installed.

```bash
npm run test:route:checks
```

The browser tests start the Next.js app and a loopback-only synthetic
authentication/API fixture automatically. They do not call live OSRM, a
production database, or real credentials. To run just the browser scenarios,
use `npm run test:route:e2e`; the frontend/backend helper checks are available
as `npm run test:route:helpers` and `npm run test:route:backend`.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
