---
name: abheepay-architecture-guide
description: >-
  Standard development guide for AbheePay. Contains the project color scheme,
  standard operational workflows, and complete file structures for pos-server
  and pos-client to eliminate repetitive codebase scanning.
---

# AbheePay Project Architecture & Development Guide

This skill serves as the primary technical specification and operational standard for the AbheePay application. Reference this specification directly for design consistency, architecture patterns, and file navigation.

---

## 1. Color Palette & UI Design System

The application uses Tailwind CSS with customized theme tokens:

- **Primary Brand / Action Accent:** `#00D3CD` (Teal / Cyan)
  - Active navigation tabs: `bg-[#00D3CD] text-white`
  - Primary buttons & progress indicators: `#00D3CD`
- **Sidebar & Shell Palette:**
  - Background: `bg-gray-900` (or `bg-red-950` / `bg-emerald-950` depending on theme switch)
  - Borders / Dividers: `border-gray-700` (or matching theme border)
  - Hover background: `hover:bg-gray-800` (or matching theme hover)
  - Default text: `text-gray-400` / `text-gray-300`
  - Active text: `text-white`
- **Status / Alert Colors:**
  - Success: `text-green-500`, `bg-green-500/10`, `border-green-500`
  - Pending / Warning: `text-yellow-500`, `bg-yellow-500/10`, `text-amber-600`
  - Failure / Reversal / Logout: `text-red-500`, `bg-red-500/10`
- **Main Layout Backgrounds:**
  - Outer app background: `bg-gray-50` / `bg-gray-100`
  - Card & Container background: `bg-white` with `shadow-md` or `shadow-lg`

---

## 2. Standard Workflows & Engineering Conventions

### A. Payout & Financial Flow Standard
1. **Balance Check & Lock:**
   - Always lock the user row using `transaction.LOCK.UPDATE` in a Sequelize managed transaction.
   - Verify available balance via `ledgerService.getAvailableBalance(merchantId)`.
2. **Debit on Initiation:**
   - Create transaction record with status `'PENDING'`.
   - Record exactly **1 debit entry** in `Ledger` (`payout_debit` or `cc_bill_payment`) for `amount + service_charge`.
   - Commit the transaction before dispatching HTTP calls to third-party payment gateways.
3. **Idempotent Refund on Terminal Failure (`FAILED`):**
   - Webhooks, status polling endpoints, and reconciliation crons must query:
     ```javascript
     const existingRefund = await Ledger.findOne({
       where: {
         transaction_type: 'payout_refund',
         reference_id: transaction.id,
         reference_table: 'PayoutTransactions',
       },
       transaction,
     });
     ```
   - Only create the refund entry if `existingRefund` is null and `autoRefundProcessed` is false.
   - Once finalized as `SUCCESS` or `FAILED`, prevent subsequent status flip.

### B. POS Collections Flow (Double-Entry Idempotency)
- POS card collections require a 2-entry double ledger transaction:
  1. `pos_credit`: Full transaction gross amount.
  2. `pos_charge`: MDR charge + GST fee deduction.
- Guarded by `merchantTransactionChargeId` or `razorpayTransactionId` in `ledgerService.js` to block duplicate webhook triggers.

### C. Access Control & Roles
- **Roles:** `Admin`, `Employee`, `Franchise`, `Merchant`.
- Routes in `pos-server` use `validateTokenHandler` + `employeePermissionHandler`.
- Frontend views use role layouts: `AdminLayout`, `FranchiseLayout`, `MerchantLayout`.

---

## 3. Codebase File Structure

### pos-server (`c:\Users\anshm\OneDrive\Desktop\AbheePay\pos-server`)
```text
pos-server/
├── config/                  # DB connection (Sequelize, MySQL pool)
├── controllers/             # Request handlers
│   ├── cc/                  # Credit card bill payment controllers
│   │   ├── bbps/            # BBPS bill payments (bbpsCCBillController.js)
│   │   └── billAvenue/      # BillAvenue & CC Bill 3 (ccBill3Controller.js, billAvenueBillController.js)
│   ├── credxpay/            # CredXPay collection webhook controllers
│   ├── payments/            # Gateway payout integrations
│   │   ├── branchxController.js
│   │   ├── branchxWebhookController.js
│   │   ├── mxPayoutController.js
│   │   ├── mxWebhookController.js
│   │   └── sddsController.js
│   ├── adminWalletController.js
│   ├── ledgerController.js
│   ├── ndia5Payout.controller.js
│   ├── sevenpayPayout.controller.js
│   ├── vimoController.js
│   └── walletTransactionController.js
├── cron/                    # Automated reconciliation tasks
│   ├── resolvePendingBranchx.js
│   ├── resolvePendingMx.js
│   ├── resolvePendingNdia5.js
│   ├── resolvePendingSevenpay.js
│   ├── resolvePendingCcBillPayment.js
│   └── resolvePendingBillAvenueCcBill.js
├── middleware/              # validateTokenHandler, employeePermissionHandler, uploadMiddleware
├── models/                  # Sequelize models: User, Ledger, PayoutTransaction, WalletTransaction, etc.
├── routes/                  # Express route definitions (adminRoutes, payoutRoutes, vimoRoutes, etc.)
├── services/                # Core business services: ledgerService.js, chargeService.js, gateway APIs
└── server.js                # App entrypoint, middleware mounting, and route bindings
```

### pos-client (`c:\Users\anshm\OneDrive\Desktop\AbheePay\pos-client`)
```text
pos-client/
├── src/
│   ├── api/                 # Axios clients and query handlers
│   ├── assets/              # Logo, images, static icons
│   ├── components/          # Shared UI widgets
│   │   ├── Franchise/       # FranchiseSidebar.jsx, FranchiseHeader
│   │   ├── Reports/         # Download buttons, ReportTabs
│   │   ├── HeaderInfo.jsx
│   │   ├── MerchantHeaderInfo.jsx
│   │   └── Sidebar.jsx      # Admin/employee primary sidebar
│   ├── layouts/             # Route shells with role guards
│   │   ├── AdminLayout.jsx
│   │   ├── FranchiseLayout.jsx
│   │   └── MerchantLayout.jsx
│   ├── Pages/               # Screen components
│   │   ├── Auth/            # Login.jsx, Signup.jsx
│   │   ├── Kyc/             # ApplyKyc.jsx
│   │   ├── Merchant/        # MerchantSideBar.jsx, MerchantDashboard.jsx, MerchantLedger.jsx
│   │   ├── AdminLedger.jsx
│   │   ├── BillAvenueCCBillPay.jsx
│   │   ├── CCBillPay.jsx
│   │   ├── Dashboard.jsx
│   │   ├── Ledger.jsx
│   │   ├── Ndia5Payout.jsx
│   │   ├── SevenPayPayout.jsx
│   │   ├── VimoPayout.jsx
│   │   ├── BranchXPayout.jsx
│   │   └── Wallet.jsx
│   ├── utils/               # auth.js, accessControl.js, serviceFlags.js
│   ├── App.jsx              # Top-level Router and Layout declarations
│   └── main.jsx             # React entrypoint with React Query Client & ToastContainer
└── tailwind.config.js       # Tailwind configuration with primary color #00D3CD
```
