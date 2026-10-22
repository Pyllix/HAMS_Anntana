# React + Vite

## Node.js runtime

Use Node.js 24.22.1 LTS or a newer 24.x release. `.nvmrc` pins the shared
development version used by the frontend and backend; `package.json` requires
at least the October 2026 security release.

## Use the Render test backend during local frontend development

Copy `front-end/.env.local.example` to `front-end/.env.local`. The example contains:

```env
DEV_API_PROXY_TARGET=https://hams-anntana-test.onrender.com
```

Restart the Vite development server after changing this file. Browser API requests still use `/api`; Vite forwards them to the configured backend. Omit this setting to use the local backend at `http://localhost:3000`. `.env.local` is ignored by Git, so each developer can choose their own target.

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is enabled on this template. See [this documentation](https://react.dev/learn/react-compiler) for more information.

Note: This will impact Vite dev & build performances.

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
