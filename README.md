# AbheePay POS Client

AbheePay POS Client is a comprehensive Point-of-Sale frontend management dashboard built with React. It features a hierarchical Role-Based Access Control (RBAC) system to serve Admins, Franchises, and Merchants with specialized functionality, reporting, and tools like Credit Card Bill Pay and POS machine management.

## 🚀 Tech Stack

- **Frontend Framework:** React 19 (via Vite)
- **Routing:** React Router v7
- **State Management & Data Fetching:** TanStack Query (React Query)
- **Styling:** Tailwind CSS (v3), PostCSS
- **Icons & UI:** Lucide React, React Icons, React Select
- **Notifications:** React Toastify
- **Data Exporting:** jsPDF, html2canvas, SheetJS (xlsx)
- **HTTP Client:** Axios
- **Linting:** ESLint

## ✨ Core Features & Functionality

### 1. Hierarchical Architecture
The platform is designed to support a multi-level role system:
- **Admin Layout (`/admin/*`)**: Full master access to create and manage franchises, merchants, system ledgers, verify KYC requests, and configure universal rate structures.
- **Franchise Layout (`/franchise/*`)**: Middle-layer access to onboard and manage their downstream merchants, track their POS machines, and monitor their specific commission earnings.
- **Merchant Layout (`/merchant/*`)**: End-user access to initiate payouts, process bills, request KYC verification, manage complaint tickets, and view personalized ledgers.

### 2. Credit Card Bill Payment (CC Bill Pay)
A fully integrated, multi-step React-based flow that enables fetching, reviewing, and paying Credit Card bills directly from the dashboard using the underlying BBPS / InstantPay API structures. Protected via real-time KYC status checks for secure access.

### 3. KYC (Know Your Customer) System
Dedicated onboarding flows allowing unverified users (Merchants/Franchises) to apply for KYC validation. It incorporates an OTP Verification modal flow and robust backend form submission.

### 4. Financial & Activity Dashboards
- **Payout Handling**: Remitter detail management and transaction history views.
- **Ledger & Commission Setting**: Modular interfaces to review hierarchical slabs.
- **Comprehensive Reporting**: Exportable Excel/PDF reports encompassing transaction history, POS machine status, payouts, and Razorpay notifications.
- **Stock & POS Management**: Allows admins and franchises to allocate and track POS devices accurately.

## 📂 Project Structure Overview

```text
src/
├── api/             # Axios API integration modules (bbpsApi, kycApi, reportsApi, authApi, etc.)
├── assets/          # Static files, images (e.g., logos)
├── components/      # Reusable UI components (Modals, Loaders, Layout Sidebars, Tables)
├── context/         # Global React context providers (e.g., UserCreationContext)
├── hooks/           # Custom React hooks (e.g., useDashboardData)
├── layouts/         # Layout wrappers controlling Nav/Sidebar per Role (Admin/Franchise/Merchant)
├── Pages/           # Primary route components mapping to dashboard views
├── App.jsx          # Root component containing React Router configuration and Suspense boundaries
├── App.css          # Core CSS imports and Tailwind directives
└── main.jsx         # Application entry point mounting the DOM
```

## 🛠️ Installation & Setup Workflow

**1. Clone the Repository:**
```bash
git clone https://github.com/Abheepay-POS/pos-client.git
cd pos-client
```

**2. Install Dependencies:**
```bash
npm install
```

**3. Set up Environment Variables:**
Create a `.env` file referencing the backend endpoints required for APIs. (Example: `VITE_API_BASE_URL`)

**4. Run Locally (Development Server):**
```bash
npm run dev
```
The application will be accessible at `http://localhost:5173`.

## 📦 Build Commands

- **`npm run dev`**: Starts the interactive Vite development server with Hot-Module Replacement.
- **`npm run build`**: Transpiles and packages the application for production deployment into the `dist` directory.
- **`npm run preview`**: Uses Vite to preview the production-ready build mimicking the live environment.
- **`npm run lint`**: Executes ESLint to verify codebase formatting and rules are met without errors.

## 🤝 Contribution Guidelines
When making PRs, ensure you push to a working feature branch and submit a PR to `main` matching the standard structure. Remember to run `npm run lint` and verify builds locally before pushing.
