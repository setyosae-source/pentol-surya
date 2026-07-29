import fs from 'node:fs';
import path from 'node:path';

const requiredFiles = [
  'index.html',
  'public/manifest.webmanifest',
  'public/service-worker.js',
  'src/main.js',
  'src/app.js',
  'src/styles.css',
  'src/data/authRepository.js',
  'src/data/shiftRepository.js',
  'src/data/operationsRepository.js',
  'src/data/ownerRepository.js',
  'supabase/migrations/001_initial_schema.sql',
  'supabase/functions/admin-reset-pin/index.ts',
  'supabase/functions/admin-create-employee/index.ts',
  'docs/roadmap.md',
  'docs/deployment.md',
];

const missing = requiredFiles.filter((file) => !fs.existsSync(path.resolve(file)));

if (missing.length) {
  console.error('Missing required files:');
  missing.forEach((file) => console.error(`- ${file}`));
  process.exit(1);
}

const migration = fs.readFileSync('supabase/migrations/001_initial_schema.sql', 'utf8');
const frontendSupabaseClient = fs.readFileSync('src/core/supabaseClient.js', 'utf8');
const createEmployeeFunction = fs.readFileSync('supabase/functions/admin-create-employee/index.ts', 'utf8');
const checks = [
  ['RLS enabled', /enable row level security/i],
  ['Audit trigger', /audit_row_changes/i],
  ['Storage bucket', /shift-photos/i],
  ['Dashboard KPI RPC', /dashboard_kpis/i],
  ['Employee login resolver', /resolve_employee_login/i],
  ['Frontend avoids custom CORS headers', !/x-application-name/i.test(frontendSupabaseClient)],
  ['Employee function uses server-side internal email', /employees\.pentolsurya\.app/i.test(createEmployeeFunction)],
];

const failed = checks.filter(([, pattern]) => {
  if (typeof pattern === 'boolean') return !pattern;
  return !pattern.test(migration);
});
if (failed.length) {
  console.error('Migration checks failed:');
  failed.forEach(([label]) => console.error(`- ${label}`));
  process.exit(1);
}

console.log('Pentol Surya project checks passed.');
