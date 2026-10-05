/**
 * M15-FR-07 · Create a staff member from the command line (the first admin in production).
 *   STAFF_PASSWORD='…' npm run staff:create -- --email admin@example.org --name "Admin Name" --roles admin
 * Uses the same configuration as the web app (DATABASE_URL, DATA_KEYS …), resolved from apps/web.
 */
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { createStaff, isStaffRole, loadConfig, migrate, openDatabase, MIN_PASSWORD_LENGTH } from '@identity/db';
import { repoRoot } from './spec/specs';

const { values } = parseArgs({ options: { email: { type: 'string' }, name: { type: 'string' }, roles: { type: 'string', default: 'admin' } } });
const password = process.env.STAFF_PASSWORD ?? '';
const roles = (values.roles ?? '').split(',').map((r) => r.trim()).filter(Boolean);
if (!values.email || !values.name) throw new Error('Give --email and --name');
if (password.length < MIN_PASSWORD_LENGTH) throw new Error(`Set STAFF_PASSWORD (at least ${MIN_PASSWORD_LENGTH} characters)`);
if (roles.length === 0 || !roles.every(isStaffRole)) throw new Error(`--roles must be a comma-separated list of known roles`);

const config = loadConfig(process.env, join(repoRoot, 'apps/web'));
const database = await openDatabase({ ...(config.databaseUrl ? { url: config.databaseUrl } : {}), pgliteDir: config.pgliteDir });
await migrate(database.db);
const id = await createStaff(database.db, { email: values.email, name: values.name, password, roles: roles as never }, { kind: 'system', id: null });
await database.close();
console.log(`Created staff member ${id} (${values.email}) with roles ${roles.join(', ')}. They set up two-step verification at first sign-in.`);
