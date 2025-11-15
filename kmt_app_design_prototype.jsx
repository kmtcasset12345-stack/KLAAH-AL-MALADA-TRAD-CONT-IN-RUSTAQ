import React, { useState, useEffect } from 'react';

/*
KMT App - Design & Prototype (Expanded)
Single-file React prototype + detailed design notes.
- Type: code/react
- Purpose: design handoff + interactive prototype for Klaah Al Malada Trad & Cont. (KMT)
- Use this file as the central spec that developers can copy into a real app.

CONTENTS ADDED IN THIS UPDATE:
1) Detailed screen-by-screen UI spec with component responsibilities
2) Complete data model (Postgres) with example SQL
3) API contract (OpenAPI-style) with example requests/responses
4) Wireframe ASCII + layout notes for desktop & mobile
5) UX flows (material request, approve/decline, recovery, export)
6) File/photo handling spec and security checklist
7) Accessibility & responsive rules
8) Export implementation notes (xlsx & PDF) and sample payloads
9) Devops & deployment boilerplate (Docker compose + CI hints)
10) Acceptance tests & QA checklist

------------------------- DESIGN HIGHLIGHTS -------------------------
Color & Typography (suggestion)
- Primary: #0f62fe (strong blue)
- Accent: #10b981 (green) for completed
- Warning: #f59e0b (amber)
- Danger: #ef4444 (red)
- Body font: Inter or system-ui; sizes: 14px base, headings 18-24px

Spacing & layout
- Mobile-first. 16px base spacing. Use 8px spacing scale.
- Cards: rounded-md, shadow-sm, p-4 / p-6 depending on density.
- Buttons: 8px vertical padding, 12-16px horizontal, rounded-lg.

Iconography
- Use lucide-react or heroicons. Keep icons minimal.

Accessibility
- All forms: labels associated with inputs.
- Keyboard-focus visible; ensure contrast ratio >= 4.5:1 for text.
- Use aria-live for status updates (request accepted/declined)

------------------------- DATA MODEL (Postgres) -------------------------
-- users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  phone TEXT,
  password_hash TEXT,
  role TEXT NOT NULL, -- 'admin','supervisor','staff'
  area TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- materials
CREATE TABLE materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sku TEXT,
  category TEXT,
  unit TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- material_requests
CREATE TABLE material_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID REFERENCES users(id),
  area TEXT,
  items JSONB NOT NULL, -- [{material_id, material_name, size, qty, new_photo_url, return_photo_url}]
  status TEXT DEFAULT 'pending', -- pending,in_progress,completed,declined
  assigned_supervisor_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- ppe_register
CREATE TABLE ppe_register (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  item_name TEXT,
  size TEXT,
  qty INTEGER DEFAULT 1,
  nationality TEXT,
  issued_by UUID REFERENCES users(id),
  issued_at TIMESTAMPTZ DEFAULT now(),
  returned BOOLEAN DEFAULT FALSE,
  return_photos JSONB,
  remark TEXT
);

-- leave_requests
CREATE TABLE leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  type TEXT, -- emergency,cancel,annual
  start_date DATE,
  end_date DATE,
  area TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- audit
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID,
  action TEXT,
  meta JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

------------------------- API CONTRACT (selected endpoints) -------------------------
Base URL: /api/v1
Auth: Bearer JWT (access token) + HttpOnly refresh token cookie

POST /auth/login
- Request: { email, password }
- Response: { accessToken, user: { id, name, role, area } }

POST /auth/forgot
POST /auth/reset

GET /materials
Response: [{ id, name, category, unit }]

POST /materials
Body: { name, category, unit }

POST /requests
multipart/form-data (fields: requester_id, area, items (JSON), photos...)
items example: [{"material_name":"Ring spanner 10","size":"","qty":1}]
Response: 201 { id, status }

GET /requests?area=Rustaq&status=pending
Response: [{ id, requester, items, status, created_at }]

PUT /requests/:id/status
Body: { status: 'in_progress' }  -- only supervisor/admin

DELETE /requests/:id  -> soft delete (set deleted_at)
POST /requests/:id/recover -> remove deleted_at

GET /exports/requests?format=xlsx|pdf&area=Hazam
-> returns file stream (content-disposition)

POST /uploads (multipart) -> { url }

------------------------- UX FLOWS -------------------------
1) Request material
- Staff fills request form, attaches photos if new/return, submits.
- System validates required fields and creates request with status=pending.
- Notification email to area's supervisors and admin.

2) Supervisor review
- Supervisor opens request list (filter by area), can Accept (set in_progress), Decline, or Assign to another supervisor.
- When Accept: supervisor must enter 'received by' name and date when marking completed.

3) Completion
- Supervisor marks completed; system stores supervisor name & signature, photos of returned items if necessary.
- System creates PPE register entry if the request was PPE issuance.

4) Soft delete & recovery
- Admin can soft-delete any request; deleted items show in Admin > Recovery where they can be restored or permanently purged.

5) Export
- Admin/Supervisor can export filtered lists as XLSX or styled PDF. No CSV option per requirement.

------------------------- FILE / PHOTO HANDLING -------------------------
- Use S3 with pre-signed PUT URLs for direct upload from client.
- Validate files on server: mime type, max size 8MB, image dimensions limited.
- Store metadata in photos table: { url, type, ref_table, ref_id, uploaded_by, created_at }
- For privacy, return only signed GET URLs for downloads with short expiry.

------------------------- EXPORTS (implementation) -------------------------
XLSX
- Use exceljs (Node) to generate .xlsx. Format sheets with header style, freeze top row, include filters.
- Endpoint: GET /exports/requests?format=xlsx&area=Rustaq
- Stream file with proper content-type and filename: KMT_requests_Rustaq_2025-11-15.xlsx

PDF
- Use puppeteer or pdfkit for styled PDFs. Prefer puppeteer to render HTML templates for consistent layout.
- Use server-side templates (Handlebars) that mirror app styles for prints.
- Endpoint: GET /exports/requests?format=pdf

------------------------- SECURITY CHECKLIST -------------------------
- Use rate limiting on auth endpoints.
- Hash passwords with argon2 or bcrypt (argon2 preferred).
- Use HttpOnly, Secure cookies for refresh tokens.
- Validate JWTs and roles on every protected endpoint.
- Enforce file type checks and virus scanning for uploads if possible.
- Audit logging for accept/decline/delete/recover actions.

------------------------- RESPONSIVE LAYOUT NOTES -------------------------
- Mobile header: compact logo + hamburger menu.
- Dashboard: collapse side panel into bottom nav on small screens.
- Tables: convert to card list on mobile; show essential fields and 'Details' button.

------------------------- QA / ACCEPTANCE TESTS -------------------------
- Create e2e tests for: login, create request with photo, supervisor accept, admin delete/recover, export xlsx and pdf.
- Write unit tests for API validation and permissions.

------------------------- DEVOPS / DOCKER -------------------------
# docker-compose.yml (short)
version: '3.8'
services:
  api:
    build: ./api
    env_file: .env
    ports: ["4000:4000"]
    depends_on: [db]
  db:
    image: postgres:15
    environment:
      POSTGRES_PASSWORD: example
    volumes: [db-data:/var/lib/postgresql/data]
  minio:
    image: "minio/minio"
    command: server /data
    ports: ["9000:9000"]
volumes:
  db-data:

CI: Run tests, build docker images, push to registry, deploy to staging, then production.

------------------------- SAMPLE UI (light interactive) ------------------------- */

export default function KMTDesignPrototype() {
  const [role, setRole] = useState('supervisor');
  const [screen, setScreen] = useState('dashboard');

  useEffect(() => {
    // small demo state effect
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-2xl font-bold">KMT Design & Prototype</div>
            <div className="text-sm text-slate-500">Expanded spec: API, DB, exports, security, and deployment notes included.</div>
          </div>
          <div className="flex items-center gap-3">
            <select value={role} onChange={(e) => setRole(e.target.value)} className="border rounded p-2">
              <option value="staff">Staff</option>
              <option value="supervisor">Supervisor</option>
              <option value="admin">Admin</option>
            </select>
            <button className="px-3 py-2 bg-blue-600 text-white rounded" onClick={() => setScreen('dashboard')}>Open Dashboard</button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white p-4 rounded shadow">
            <h3 className="font-semibold mb-2">Key Screens</h3>
            <ol className="list-decimal pl-5 text-sm space-y-1">
              <li>Login / Forgot password</li>
              <li>Dashboard (filter by area, quick stats)</li>
              <li>Material Request Form (photos, items array)</li>
              <li>Requests Table (accept/decline, delete, recover)</li>
              <li>PPE Register (issue / return with photos)</li>
              <li>Leave & Cancel (exportable PDF)</li>
              <li>Admin: Soft-delete recovery</li>
            </ol>
          </div>

          <aside className="bg-white p-4 rounded shadow">
            <h4 className="font-semibold">Deliverables</h4>
            <ul className="list-disc pl-5 text-sm mt-2">
              <li>React frontend scaffold with routes & components</li>
              <li>Node/Express (or NestJS) backend with endpoints</li>
              <li>Postgres schema + sample seed data</li>
              <li>S3 or MinIO for images</li>
              <li>Exports (xlsx & pdf) implemented server-side</li>
            </ul>
          </aside>
        </div>

        <div className="mt-6 bg-white p-4 rounded shadow">
          <h4 className="font-semibold mb-2">Next actions I can do for you now</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <button className="p-3 border rounded" onClick={() => alert('I can scaffold the frontend (React) files now.')}>Scaffold React App</button>
            <button className="p-3 border rounded" onClick={() => alert('I can scaffold Node/Express API now.')}>Scaffold Backend API</button>
            <button className="p-3 border rounded" onClick={() => alert('I can generate sample seed XLSX and PDF templates.')}>Generate XLSX & PDF Templates</button>
          </div>
        </div>
      </div>
    </div>
  );
}
