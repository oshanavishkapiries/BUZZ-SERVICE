const express = require('express');
const app = express();
const PORT = process.env.PORT || 3001;

// --- Data pools ---
const FIRST_NAMES = [
  'Ashan', 'Dilani', 'Kavindu', 'Nethmi', 'Chamara', 'Sanduni',
  'Lahiru', 'Thisari', 'Nuwan', 'Hasini', 'Ruwan', 'Malini',
  'Sachith', 'Imesha', 'Binura', 'Thilini', 'Kasun', 'Amali',
  'Dinesh', 'Pramodhi', 'Shehan', 'Nadeesha', 'Tharaka', 'Ishara',
  'Vimukthi', 'Oshadi', 'Chanaka', 'Dulani', 'Rasitha', 'Hiruni',
];

const LAST_NAMES = [
  'Perera', 'Silva', 'Fernando', 'Jayawardena', 'Bandara',
  'Rathnayake', 'Wickramasinghe', 'Amarasinghe', 'Dissanayake',
  'Gunawardena', 'Senanayake', 'Kumarasinghe', 'Jayasuriya',
  'Liyanage', 'Weerasinghe', 'Pathirana', 'Rajapaksa', 'Herath',
  'Samaraweera', 'Gunasekara', 'Mendis', 'Senaratne', 'Wijesinghe',
  'Ariyaratne', 'Ranasinghe', 'Karunarathna', 'Jayasinghe', 'Udawatta',
];

const DOMAINS = [
  'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com',
  'example.com', 'mail.com', 'proton.me', 'icloud.com',
];

const COUNTRY_CODE = '+94';

// --- Generator ---
// Produces a deterministic user for a given index so pages are stable
// across paginated requests within the same session.
function generateUser(index) {
  const first = FIRST_NAMES[index % FIRST_NAMES.length];
  const last  = LAST_NAMES[Math.floor(index / FIRST_NAMES.length) % LAST_NAMES.length];
  const domain = DOMAINS[index % DOMAINS.length];

  // Vary the name a little so duplicates are obvious (e.g. "Ashan2 Perera")
  const nameSuffix = Math.floor(index / FIRST_NAMES.length) > 0
    ? String(Math.floor(index / FIRST_NAMES.length) + 1)
    : '';

  const firstName = first + nameSuffix;
  const slug      = `${firstName.toLowerCase()}.${last.toLowerCase()}`;
  const phone     = `${COUNTRY_CODE}7${String(index + 10000000).slice(1)}`;

  return {
    id:    `usr_${String(index + 1).padStart(4, '0')}`,
    name:  `${firstName} ${last}`,
    email: `${slug}@${domain}`,
    phone,
  };
}

// Total virtual users the server can hand out (change freely)
const TOTAL_USERS = parseInt(process.env.TOTAL_USERS || '50', 10);

// Build the full list once at startup
const USERS = [];
for (let i = 0; i < TOTAL_USERS; i++) {
  USERS.push(generateUser(i));
}

// --- Routes ---

// GET /users
// Supports offset pagination  (?limit=N&offset=N)  — Buzz Service default
// Supports page pagination     (?page=N&per_page=N) — when datasource uses pagination_style=page
app.get('/users', (req, res) => {
  let start = 0;
  let size  = USERS.length;

  if (req.query.page !== undefined) {
    const page    = Math.max(1, parseInt(req.query.page, 10)    || 1);
    const perPage = Math.max(1, parseInt(req.query.per_page, 10) || 10);
    start = (page - 1) * perPage;
    size  = perPage;
  } else if (req.query.offset !== undefined || req.query.limit !== undefined) {
    start = Math.max(0, parseInt(req.query.offset, 10) || 0);
    size  = Math.max(1, parseInt(req.query.limit,  10) || USERS.length);
  }

  const slice = USERS.slice(start, start + size);

  console.log(`[mock] GET /users  offset=${start} limit=${size} → ${slice.length} recipients`);

  res.json({
    recipients: slice,
    total:      USERS.length,
    offset:     start,
    limit:      size,
  });
});

// GET /health
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', total_users: USERS.length });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[mock-datasource] listening on http://localhost:${PORT}`);
  console.log(`[mock-datasource] ${USERS.length} users ready  (set TOTAL_USERS=N to change)`);
});
