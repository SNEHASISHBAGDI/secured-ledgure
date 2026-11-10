# Secure Ledger — Double-Entry Ledger System

A full-stack double-entry demonstration ledger application built with **Express 5 + MongoDB** (`backend-ledger-main/`) and **React + TypeScript + Vite + Tailwind CSS** (`frontend/`).

> **Important Notice**: This is a demonstration double-entry ledger environment. Transfers adjust internal database balances only and do not move real-world funds or connect to financial institutions.

---

## Architecture & Security Controls

### Backend (`backend-ledger-main/`)
- **Atomic Double-Entry Transactions**: Transfers create the `Transaction` record, immutable `DEBIT` ledger entry, immutable `CREDIT` ledger entry, and mark the transaction `COMPLETED` inside a single MongoDB ACID session.
- **Source Ownership Enforcement**: `POST /api/transactions/` enforces that `fromAccount` belongs to the authenticated `req.user._id`.
- **Concurrency & Anti-Overspending Lock**: Acquires an exclusive document write-lock on the source account inside the transaction session (`findOneAndUpdate`) and recalculates balance inside the snapshot after acquiring the lock.
- **Strict Monetary Validation**: Monetary values are converted to integer minor units (paise/cents, max 2 decimal places) to eliminate JavaScript floating-point precision drift.
- **Concurrent Idempotency**: Enforced via unique index on `idempotencyKey` with safe duplicate-key handling (`11000` conflict lookup).
- **Scoped Transaction History**: `GET /api/transactions/` returns paginated ledger history strictly scoped to accounts owned by the authenticated user.
- **Admin Endpoint Guard**: `POST /api/transactions/system/initial-funds` requires both `systemUser` status and a configured `SYSTEM_ADMIN_KEY` passed via `x-system-admin-key`. If `SYSTEM_ADMIN_KEY` is not set in `.env`, the endpoint is disabled (`403 Forbidden`).

### Frontend (`frontend/`)
- **Confirmation & Idempotency**: Transfer UI retains a review step prior to execution, generates one idempotency key per intended transfer, and preserves that key across retries.
- **Real-time Balance & History Refresh**: Account balances and transaction logs automatically refresh following successful transfers.

---

## Local Setup & Running

### 1. Environment Variables
See [`backend-ledger-main/.env.example`](backend-ledger-main/.env.example) for required variables in `backend-ledger-main/.env`.
- Note: MongoDB must run as a **Replica Set** (such as MongoDB Atlas) for multi-document ACID transactions.
- `SYSTEM_ADMIN_KEY` is optional; leave unset unless intentionally using the administrative initial-funds endpoint.

### 2. Install Dependencies
```powershell
npm install --prefix backend-ledger-main
npm install --prefix frontend
```

### 3. Run Servers (Windows PowerShell)
Open two terminals:

**Terminal 1 (Backend on port 3000):**
```powershell
cd backend-ledger-main; npm run dev
```

**Terminal 2 (Frontend on port 5173 with `/api` proxy):**
```powershell
cd frontend; npm run dev
```

*(Note: Windows PowerShell 5.1 uses `;` instead of `&&` to separate commands.)*

---

## Verification & Build Checks
```powershell
# TypeScript strict checking + Vite production build
npm run build --prefix frontend
```
