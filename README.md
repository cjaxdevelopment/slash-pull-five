# Rewound / WoW Forever

A private raid composition planner. Each login has its own characters and saved raids. Add **characters**, arrange groups, and check the buffs they bring. There are no player records, main/alt management, attendance, or raid scheduling in the planner.

- Saved 10, 20, and 40-man compositions with 5-person groups, a bench, notes, and duplication.
- Nine classes with class colors, draggable spec presets, role icons, names, and editable ability loadouts.
- Raid-wide and party buff coverage, including separate spell and physical crit auras, totem elements, Paladin auras/blessings, and conflicting loadouts.
- Searchable character pool: drag existing characters into groups or the bench, or back into the pool. The + button supports keyboard and mobile use.
- Exact slot placement and occupied-slot swaps, including between full groups. Dropping a pool character or spec onto an occupied slot returns its previous occupant to the pool.
- Separate Buffs, Debuffs, and Utility views, with pet support, conditional talents, and small party-buff badges beside groups.
- Read-only snapshot links that work without signing in.
- Light/dark toggle on sign-in and in the header. Follows the system theme initially and remembers your choice in this browser.
- Plain username/password sign-in.
- Separate private planners per account. Revision checks prevent an older browser tab from overwriting newer changes. Share links provide read-only viewing.

## Buff rules

Rules were reviewed on **2026-10-20** against Blizzard's October 15 beta notes and class previews, supplemented by extracted client spell data for build 1.60.1.70450. Sources are linked beside each ability in the planner. October 15 notes take precedence over older tooltips.

- Moonkin Aura and Leader of the Pack cover different crit types and are counted separately. A single Druid cannot maintain both forms.
- The updated crit auras, Trueshot Aura, Battle Shout, and the updated offensive/stat totems are raid-wide.
- Windfury and Grace of Air can coexist from separate Shamans. Each Shaman has one totem per element. Windfury and Flametongue conflict even across providers; the UI flags the conflict instead of counting both.
- Party effects such as Mana Spring and Devotion Aura cover only their provider's group. Ungrouped characters receive no party coverage. Benched characters provide and receive no counted buffs.
- Duplicate or alternate providers cover each recipient once. Each Paladin has one active aura and one assigned blanket blessing; individual in-game blessing targets can differ.
- Each Warlock has one maintained Curse, each Paladin one Judgement, and each Hunter or Warlock one selected pet. Blood Pact covers the Imp's party; the current Wolf Howl covers raid members in range.
- Enemy debuffs and utility count available characters, rather than recipients or uptime. Equivalent abilities share one effect row. Sunder/Expose availability does not add their armor reduction together. Temporary totems are utility, not simultaneous maintained buffs.
- Improved Scorch, Winter's Chill, Shadow Weaving, and Hemorrhage are personal effects in Forever and do not provide raid vulnerability coverage. Removed Classic talent improvements are not selectable raid buffs.

Coverage assumes level 60, learned talents, maintained buffs, and characters in range. Presets are starting loadouts, not a talent simulator. Edit a character to select a pet or adjust talent and ability choices. The catalog tracks maintained buffs and common debuffs, interrupts, dispels, crowd control, and support cooldowns; it does not simulate exact magnitudes, stacking priorities, target immunities, cooldown rotations, or uptime. Pet support covers the listed effects rather than every pet family. Missing effects are information, not requirements for every composition. Forever is in beta: update the sourced catalog and its tests when rules change.

## Start locally

Requires **Node.js 24** and npm. Run these commands from the repository root, not `app/`. On Windows PowerShell, use `npm.cmd` if execution policy blocks `npm.ps1`.

```sh
npm ci
```

Copy `.env.example` to `.env`. On PowerShell:

```powershell
Copy-Item .env.example .env
```

Fill in `BOOTSTRAP_USERNAME`, `BOOTSTRAP_PASSWORD` (12–128 characters), and `BOOTSTRAP_GUILD_NAME`. Set your guild's region, faction, and ruleset. Usernames use 2–40 letters, numbers, dots, underscores, or hyphens; sign-in ignores case. Choose a unique password; there are no default accounts or passwords.

```sh
npm run db:bootstrap
npm run dev
```

Open **http://localhost:5173** and sign in. Remove `BOOTSTRAP_PASSWORD` from `.env` after creating the first account. Existing installations keep their accounts and saved data. Migrations run automatically when the API starts.

Local development uses **PGlite, an embedded PostgreSQL engine**, with persistent data in `.local/postgres`. No Docker install is needed. This is a local, single-process development option; production requires network PostgreSQL. Do not run multiple local API/CLI processes against the same PGlite data directory. Stop `npm run dev` before running database CLI commands against it. `DATABASE_DIRECTORY` can select another local directory; keep it outside source control.

Create a raid and choose its size. The + beside **Characters** opens a small class/spec form; names are optional. Characters are created in the pool, ready to drag into groups or onto the bench. Click a character to edit its name, role, and buff loadout. Drag it back to the pool or click its X to remove it from this raid. Use the pool's + buttons and group menus for keyboard and mobile access; + uses the selected "Add to" destination. The bench does not contribute buffs.

Choose **Specs** in the pool to drag a class/spec directly into a raid slot, or use its + button with the selected destination. This creates a reusable character with a suggested loadout. Drop an assigned character on another character to swap positions; this also works when both groups are full or the incoming character is benched. Drop on an empty slot to place it precisely. Returning a character to the pool preserves it for this and other compositions.

The raid's three-dot menu contains editing, duplication, sharing, and deletion. **Buffs**, **Debuffs**, and **Utility** each use a compact checklist: click an effect for its providers and sources, or choose **Table** for the group matrix. Small group badges show active party buffs. Notes, rules, and source references expand on demand.

**Share link** creates a read-only snapshot encoded in the URL fragment. It includes the raid name, character names/loadouts, positions, and bench, without workspace IDs, notes, or account data. Anyone with the link can view it without signing in. Subsequent edits do not update old links; create a new link to share changes. Snapshots use the viewer's current supported catalog and are limited to 80 assigned characters, including the bench. Sharing requires a modern browser with CompressionStream support.

Compositions remain independent: moving or removing a character changes only the selected composition. Characters can be reused across compositions; editing a character updates its shared name, spec, role, and buff loadout everywhere. Duplicate a composition to experiment with a different arrangement.

To permanently remove an unwanted character, use the trash icon in the character pool and confirm **Delete character**. Deletion removes it from the pool and every saved raid. The X on a raid character still returns it to the pool for reuse.

### Private accounts

You, Bru, CT, and Peko use the same app URL and separate logins. Each account owns its own planner and cannot see or edit another account's saved data. Public sign-up and shared-edit invitations are disabled. A private `/plans/...` URL does not grant access; use **Share link** for a read-only snapshot, or send a screenshot.

After the initial account exists, stop the local dev server and run:

```sh
npm run db:seed-accounts
```

This creates `bru`, `ct`, and `peko` with separate empty planners and generated passwords. Login details are saved in a private, ignored `.local/rewound-logins-*.txt` file; give each person only their own login. Existing accounts, passwords, and rosters are left unchanged, so the command is safe to repeat. The generated file is a one-time credential handoff, not an ongoing application dependency. Keep it private and remove it after delivering the logins. Restart `npm run dev` afterward.

To create a different account, set `ACCOUNT_USERNAME` and `ACCOUNT_PASSWORD` in `.env`, stop the local server, and run `npm run db:create-account`. Remove the password from `.env` afterward. This command refuses to replace an existing account. The same CLI commands work against the configured hosted PostgreSQL database; in a production image use `node app/server/dist/cli.js seed-accounts` or `create-account` from the repository root.

`localhost` works on your own computer. For Bru, CT, and Peko to connect from their computers, deploy this same app and database to an accessible HTTPS host as described below. Accounts created locally are in the local database; seed the accounts against the hosted database when deploying.

## PostgreSQL and production

For a local PostgreSQL server, add `POSTGRES_PASSWORD` to `.env`, matching the password in `DATABASE_URL`, then:

```sh
docker compose up -d db
```

Set `DATABASE_MODE=postgres`, `DATABASE_URL` to a dedicated database, and run `npm run db:bootstrap` against the empty database. Migrations also run automatically before the API starts, and can be run explicitly with `npm run db:migrate`. Applied migration checksums are verified; add a new migration instead of changing one already applied.

```sh
npm run build
npm start
```

In production, set:

- `NODE_ENV=production`
- `DATABASE_MODE=postgres`
- `DATABASE_URL` to your PostgreSQL connection string; configure TLS according to your database provider's instructions, without disabling certificate verification.
- Production database connections automatically use verified TLS. If your provider uses a separate CA bundle, set `DATABASE_SSL_CA_FILE` to its path. Heroku buildpacks include their CA store at `/usr/lib/ssl/certs/ca-certificates.crt`. For external Heroku connections, download the [official AWS RDS bundle](https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem) and use its local path. Insecure `no-verify` and production `sslmode=disable` settings are rejected.
- `APP_ORIGIN` to the exact HTTPS origin, without a trailing slash, e.g. `https://roster.example.com`.
- `PORT` to the HTTP port, default `5000`.
- `TRUST_PROXY=true` **only** if there is exactly one trusted reverse proxy in front of the application. Otherwise leave it false. HTTPS termination belongs at that proxy or your hosting platform.

Express serves the Vite build and API from the same origin. Host on a Node-capable service or build the included Dockerfile. No Vercel-specific services are required. The container runs as a non-root user. Docker and hosted PostgreSQL deployment are configured here but must be verified in your target hosting environment.

### Heroku / slashpullfive.com

The root `Procfile` starts the compiled server and applies migrations during Heroku's release phase. The Node buildpack runs the root build script before pruning development dependencies. Deploy the full repository root, including all three npm workspaces. The server reads Heroku's assigned `PORT`; do not pin it in production. Migrations use a transaction advisory lock so release and startup checks cannot apply a migration concurrently.

The production configuration is `NODE_ENV=production`, `DATABASE_MODE=postgres`, `APP_ORIGIN=https://slashpullfive.com`, `TRUST_PROXY=true`, and `DATABASE_SSL_CA_FILE=/usr/lib/ssl/certs/ca-certificates.crt`. Heroku supplies `DATABASE_URL`. Requests to alternate hosts or HTTP redirect to the canonical HTTPS origin, preserving their path. `/api/health` remains available for health checks. Use one Basic web dyno and the Essential-0 Postgres plan initially.

Both `slashpullfive.com` and `www.slashpullfive.com` should be registered under the app's custom domains, with automatic certificates enabled. DreamHost uses an ALIAS record for the root and CNAME for `www`; each should target the value shown by `heroku domains --app slash-pull-five`. Keep email-related DNS records. [Heroku domain setup](https://devcenter.heroku.com/articles/custom-domains).

### Moving the local database to production

`npm run db:export` creates a private `.local/database-transfer-*.json` file with accounts, password hashes, private planners, characters, exact raid slots, legacy person links, and audit data. Stop the local API before exporting its embedded database. Sessions and old invitations are excluded, so everyone signs in again after a move. This is different from the roster-only JSON export in the app.

To restore, configure the destination PostgreSQL connection and verified TLS, set `DB_IMPORT_FILE` to that file's absolute path, and run `npm run db:restore` (or `node app/server/dist/cli.js restore-database` in a production runtime). Source and destination must use the same migrations. The destination must contain no application data or sessions. Restore refuses to overwrite an existing installation, inserts in a single transaction, and verifies every transferred table before committing. An invalid row or failed verification rolls back the whole transfer. Keep the transfer file private and outside Git.

After a successful deployment, verify `/api/health`, all four logins, private roster access, and read-only sharing. Schedule database backups and retain the pre-deployment release/configuration for rollback. A code rollback cannot reverse a database migration; check migration compatibility before rolling back to an older application.

Authentication uses database-backed, expiring sessions with HttpOnly cookies, Secure cookies in production, SameSite=Strict, exact-origin write checks, and session CSRF tokens. Inputs are validated server-side, account ownership is rechecked inside write transactions, and database constraints protect cross-workspace relationships. Login is rate-limited. Passwords are hashed with salted scrypt. Session tokens and password hashes are not returned in planner data or logged.

Keep this as one application instance initially: request rate limits are in memory. Before running multiple API instances, use a shared rate-limit store and coordinate migrations as a deployment step. Set up automated database backups and test restoration. JSON workspace export is a portable data snapshot, not a full authentication/database backup or an automatic restore format.

### Password recovery

This private tool has no email reset service. An administrator with server/database access can set `RESET_USERNAME` and `RESET_PASSWORD` in `.env`, stop the local server if using PGlite, then run:

```sh
npm run db:reset-password
```

This resets that account's password and revokes all its sessions. Remove the reset password from `.env` immediately afterward. In a production image without development dependencies, run `node app/server/dist/cli.js reset-password` from the repository root.

## Existing data and migration

The new `002_composition_planner.sql` migration preserves existing accounts, characters, assignments, and compositions. Existing first/surnames become one display name. Existing characters start with a custom spec and known baseline buffs; review them and choose the intended spec/loadout. Legacy player records remain in the database for preservation but are no longer exposed by the planner. No database reset or new login is needed. Restart the development server to apply the migration.

`004_abilities_and_slots.sql` assigns existing grouped characters stable slots and adds the expanded baseline abilities to existing loadouts. It preserves existing selected buffs. Review talent and pet choices manually; the migration does not guess them. Restart the API to apply it automatically.

`005_private_planners.sql` retires shared-edit invitations and officer access. Existing owners keep their characters, saved raids, logins, and passwords. Former collaborators receive their own empty private planner, retaining their username/password and the prior region/faction/ruleset. Existing shared rosters stay with their original owner. Old invitation links no longer grant access. Read-only share links continue to work.

The original Retail/MongoDB application and its one-time exporter are retired. This application uses PostgreSQL only. Old `MONGODB_URI`, `JWT_SECRET`, and `REACT_APP_API_URL` settings are unused and should be removed from the hosting configuration. Keep applied SQL migrations: their checksums are verified on startup and they preserve existing accounts and rosters.

Character exchange API endpoints are scoped to the signed-in account's planner: `GET /api/guilds/:id/export.csv`, `POST /api/guilds/:id/import` with `{ "csv": "..." }`, and `GET /api/guilds/:id/backup`. Writes require the normal origin and CSRF headers. JSON export is available as **Export data** in the raid menu.

CSV headers: `name,class,spec,role,buffs`. Use lowercase class/spec keys, `custom` for an unspecified spec, and `tank`, `healer`, `melee`, or `ranged` for role. Buffs is a quoted JSON array of ability IDs from `app/shared/src/buffs.ts` and `abilities.ts`, including selected debuffs and utility. Imports create characters and roll back entirely on invalid rows or duplicate names; they do not merge. CSV export escapes spreadsheet formulas.

## Development and verification

```sh
npm run check       # Formatting, TypeScript, domain/API/migration tests, production build
npm run test:e2e    # Four private logins, comps, templates, swaps, pets, read-only sharing, desktop/mobile
```

Browser tests use a new isolated `.local/e2e-*` database on ports 5018/5178. Chrome is the default local browser. Alternatively install Playwright Chromium and set `PLAYWRIGHT_CHANNEL=chromium`. Screenshots are saved under `.local/qa-*.png`; failed tests include traces in `test-results/`.

API tests use in-memory PGlite by default. `TEST_DATABASE_URL` enables integration testing against network PostgreSQL, and its database name **must end in `_test`**. Tests truncate that database's application tables. CI covers embedded PostgreSQL, PostgreSQL 17, and Chromium.

## Repository layout

```text
app/client/               React, Vite, Tailwind, RTK Query
app/server/src/           Express, cookie sessions, database adapters, CLIs
app/server/migrations/    Versioned PostgreSQL schema
app/shared/src/           Buff catalog, spec presets, coverage, validation, CSV
e2e/                     Browser acceptance tests
```

Requires Node 24. One root npm lockfile and one install command. Vite remains the client build tool; Express serves the API and built client from one origin. No framework migration is needed for this scope.
