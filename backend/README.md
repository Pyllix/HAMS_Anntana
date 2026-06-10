# Hospital Asset & Maintenance System (HAMS)

## Project Overview

The **Hospital Asset & Maintenance System (HAMS)** is a centralized web application designed to manage hospital assets and maintenance workflows. It ensures all departments have access to a single source of truth for assets, minimizing data redundancy, and enabling real-time asset tracking.

Based on the system documentation, the project's core modules include:
- **User & Access Control:** Role-based access control for Parcel Staff, Asset Center Staff, Department Staff, Maintenance Staff, Managers, and Admins.
- **Asset Management:** Registering, tracking, and viewing the statuses of hospital equipment (e.g., active, broken, under repair, disposed).
- **Borrow & Return Management:** Managing borrowing procedures, calculating usage duration, and maintaining borrow histories.
- **Spare Parts Requisition:** Managing inventory and automatically deducting spare parts used in maintenance operations.
- **Maintenance Management:** Creating repair tickets, tracking maintenance progress, and recording repairs and parts used.
- **Asset Audit:** Recording asset counting results to compare against the system's database.
- **Reports & Dashboard:** Providing executive summaries and data-driven insights for hospital management.

## Tech Stack

This repository contains the backend service for HAMS, built with:
- **Framework:** [NestJS](https://nestjs.com/) (v11)
- **Language:** TypeScript
- **Package Manager:** pnpm
- **Testing:** Jest & Supertest
- **Code Quality:** ESLint & Prettier

## Installation

Ensure you have [Node.js](https://nodejs.org/) and `pnpm` installed.

```bash
# Install dependencies
pnpm install
```

## Development Commands

The following scripts are available via `package.json`:

```bash
# Start the application
pnpm start

# Start the application in development (watch) mode
pnpm run start:dev

# Start the application in debug mode
pnpm run start:debug

# Start the application in production mode
pnpm run start:prod

# Build the application
pnpm run build

# Format source files using Prettier
pnpm run format

# Lint source files using ESLint
pnpm run lint

# Run unit tests
pnpm run test

# Run tests in watch mode
pnpm run test:watch

# Run test coverage
pnpm run test:cov

# Run tests in debug mode
pnpm run test:debug

# Run end-to-end tests
pnpm run test:e2e
```

## Project Structure

```text
/
├── docs/                     # System documentation (SRS, Use Cases, Project Report)
├── src/                      # Application source code
│   ├── app.module.ts         # Root module of the application
│   └── main.ts               # Entry file of the application
├── test/                     # End-to-end testing files and configurations
│   ├── app.e2e-spec.ts       # E2E test specifications
│   └── jest-e2e.json         # Jest E2E configuration 
├── eslint.config.mjs         # ESLint configuration
├── nest-cli.json             # NestJS CLI configuration
├── package.json              # Project dependencies and scripts
├── pnpm-lock.yaml            # pnpm dependency lockfile
├── pnpm-workspace.yaml       # pnpm workspace configuration
├── tsconfig.json             # TypeScript compiler configuration
└── tsconfig.build.json       # TypeScript build configuration
```
