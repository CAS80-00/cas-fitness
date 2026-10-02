# CAS Fitness Web Application

Full-stack CAS Fitness implementation with:

- **Frontend:** React + Vite + Tailwind
- **Backend:** Node.js + Express
- **Database:** PostgreSQL (Neon-compatible)

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

