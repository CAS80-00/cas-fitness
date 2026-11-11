# CAS Fitness Web Application

⚠️ **STATUS:** Under Construction (Mostly Built)

This is a comprehensive full-stack fitness management platform currently in active development. Core functionality is operational, including authentication, user management, subscription handling, payment processing, and calendar management. Final refinements and additional features are in progress.

## Technology Stack

- **Frontend:** React + Vite + Tailwind CSS with CSS Modules
- **Backend:** Node.js + Express + PostgreSQL (Neon)
- **Authentication:** JWT-based with role-based access control
- **Payment Processing:** Stripe integration
- **Email/SMS:** SMTP and Twilio integration
- **Hosting:** Deployment-ready (Docker-compatible)

## Application Overview

CAS Fitness is a multi-user fitness management platform designed for gyms and personal training studios. It supports three primary user roles (Superuser/Admin, Employees/Trainers, Students/Members) with specialized workflows for each.

### Core Features

**User Management & Authentication:**

- Role-based access control (Superuser, Employee, Student)
- JWT token-based authentication with refresh mechanism
- Secure password change with OTP verification
- Two-factor authentication (OTP via email/SMS)
- Account status management (ACTIVE, INACTIVE, SUSPENDED, CANCELLED)

**Membership & Subscriptions:**

- Tiered subscription plans with auto-renewal
- Subscription management dashboard
- Payment history and receipts
- Promo code system
- Test/development card support

**Calendar & Session Management:**

- Consultation scheduling system
- Trainer session booking and tracking
- Calendar slot creation and management
- Status-based access control (only active employees can create slots)
- Personal and consolidated calendar views

**Access Control:**

- QR code generation and scanning for member door access
- 30-day scan history tracking
- Access verification dashboard

**Email & Notifications:**

- Template-based email system
- Consultation scheduling confirmations
- Plan purchase receipts
- Password reset notifications
- Configurable email templates with test functionality

**Payment Processing:**

- Stripe integration for secure payments
- Credit card management
- Payment history tracking
- Invoice generation

**Admin Dashboard:**

- User management (create, edit, delete)
- Plan management
- Email template configuration
- Promo code management
- Role and permissions management

## Database Architecture (PostgreSQL/Neon)

### Core Tables

**Authentication & Users**

- `users` — User accounts with roles, status, password hashes, phone, and authentication fields
- `sessions` — Active session tracking with JWT tokens and expiration
- `otp_codes` — One-time passwords for 2FA and password reset with expiration and attempt tracking

**Subscriptions & Payments**

- `plans` — Fitness subscription plans (tier, price, session count, duration)
- `subscriptions` — User subscription instances with renewal dates and auto-renewal status
- `payments` — Payment transactions with Stripe integration and receipt links
- `promo_codes` — Discount codes with usage tracking and expiration

**Calendar & Sessions**

- `calendars` — Calendar instances per trainer/gym
- `calendar_slots` — Time slots available for booking
- `trainer_sessions` — Booked sessions between trainer and member
- `session_logs` — Session history and completion tracking
- `consultation_schedules` — Consultation appointments
- `consultation_availability` — Trainer availability windows

**Access Control**

- `access_passes` — Member QR pass/credential generation
- `access_scans` — Historical scan records for access verification
- `user_roles` — Role definitions and capabilities

**CMS & Configuration**

- `plans_content` — SEO-optimized plan descriptions
- `email_templates` — Customizable email templates with variables
- `legal_content` — Terms, privacy policy, and legal docs with version tracking
- `seo_content` — Auto-complete content for search optimization

### Key Database Features

- JWT token revocation tracking
- Failed login attempt tracking with automatic account locking (24-hour lockout after 3 failures)
- Automatic timestamp tracking (created_at, updated_at)
- Cascading deletes for referential integrity
- Full-text search indexing on content tables
- Status-based filtering for active/inactive records

## 1) Folder Structure

- [backend/](/C:/Users/dilan/OneDrive/Documents/Fullstack/CARLOS/cas-fitness/backend)
  - `server.js`, `app.js`, `db/`, `routes/`, `middleware/`
- [frontend/](/C:/Users/dilan/OneDrive/Documents/Fullstack/CARLOS/cas-fitness/frontend)
  - `public/` — static assets
  - `src/components/` — reusable JSX components
  - `src/layout/` — `AppLayout.jsx` app-wide wrapper (cookie banner, inactivity modal)
  - `src/pages/` — route-level JSX pages
  - `src/styles/` — all CSS Modules + `global.css` (Tailwind entry + design tokens). Every component/page imports its styling from here instead of using inline utility strings.

## 2) Environment Setup

### Backend `.env` ([backend/.env](/C:/Users/dilan/OneDrive/Documents/Fullstack/CARLOS/cas-fitness/backend/.env))

```env
PORT=5000
JWT_SECRET=your_super_secret_jwt_key
CORS_ORIGIN=http://localhost:5173
CARD_ENCRYPTION_KEY=64_hex_characters_32_bytes
SMS_WEBHOOK_SECRET=shared_secret_for_sms_reply_webhook
SEED_SUPERUSER_PASSWORD=initial_superuser_password
DATABASE_URL=postgres://user:pass@host/db?sslmode=require
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_number
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your_smtp_user
SMTP_PASS=your_smtp_password
SMTP_FROM=your_from_address
TEST_CARD_NUMBER=4539148273410928
TEST_CARD_EXP=12/28
TEST_CARD_CVC=123
TEST_CARD_ZIP=10001
```

### Frontend `.env` ([frontend/.env](/C:/Users/dilan/OneDrive/Documents/Fullstack/CARLOS/cas-fitness/frontend/.env))

```env
VITE_API_BASE_URL=http://localhost:5000/api
```

## 3) Install Dependencies

```bash
cd backend
npm install

cd ../frontend
npm install
```

## 4) Initialize Database

From [backend/](/C:/Users/dilan/OneDrive/Documents/Fullstack/CARLOS/cas-fitness/backend):

```bash
psql "$DATABASE_URL" -f db/schema.sql
npm run seed
```

## 5) Run Development Servers

Terminal 1:

```bash
cd backend
npm run dev
```

Terminal 2:

```bash
cd frontend
npm run dev
```

## 6) Validation Commands

- Frontend lint: `cd frontend && npm run lint`
- Frontend build: `cd frontend && npm run build`
- Backend syntax checks:
  `cd backend && node --check app.js && node --check server.js`

## 7) Implemented Core Modules

- Auth + role/session-aware token checks ([backend/routes/auth.js](/C:/Users/dilan/OneDrive/Documents/Fullstack/CARLOS/cas-fitness/backend/routes/auth.js), [backend/middleware/authMiddleware.js](/C:/Users/dilan/OneDrive/Documents/Fullstack/CARLOS/cas-fitness/backend/middleware/authMiddleware.js))
- CMS + SEO auto-complete APIs ([backend/routes/cms.js](/C:/Users/dilan/OneDrive/Documents/Fullstack/CARLOS/cas-fitness/backend/routes/cms.js))
- Consultation/workout calendar APIs ([backend/routes/calendars.js](/C:/Users/dilan/OneDrive/Documents/Fullstack/CARLOS/cas-fitness/backend/routes/calendars.js))
- Payments + promo/test-card mode ([backend/routes/payments.js](/C:/Users/dilan/OneDrive/Documents/Fullstack/CARLOS/cas-fitness/backend/routes/payments.js))
- Member QR pass + scan verification ([backend/routes/members.js](/C:/Users/dilan/OneDrive/Documents/Fullstack/CARLOS/cas-fitness/backend/routes/members.js))
- Legal content modal persistence ([backend/routes/legal.js](/C:/Users/dilan/OneDrive/Documents/Fullstack/CARLOS/cas-fitness/backend/routes/legal.js))

## 8) Styling Architecture

All visual styling lives in [frontend/src/styles/](/C:/Users/dilan/OneDrive/Documents/Fullstack/CARLOS/cas-fitness/frontend/src/styles):

- `global.css` — Tailwind entry point (`@import "tailwindcss"`) plus CSS custom properties for the CAS Fitness color palette (matte black, charcoal, dark slate, off-white, crimson red, electric blue, neon orange).
- One `*.module.css` file per component/page. Each module starts with `@reference "./global.css";` so Tailwind's `@apply` can compose utility classes into semantic, component-scoped class names (e.g. `.card`, `.submitButton`).
- Components import their module and reference classes via `styles.xxx` — no inline Tailwind utility strings remain in JSX.
- [frontend/src/layout/AppLayout.jsx](/C:/Users/dilan/OneDrive/Documents/Fullstack/CARLOS/cas-fitness/frontend/src/layout/AppLayout.jsx) is the single app-wide wrapper (dark canvas, cookie banner, inactivity modal) shared by every route.
- Responsive rules (desktop / mobile landscape / mobile portrait) are expressed as `@media` blocks inside each module, keeping breakpoint logic co-located with the component it affects.
