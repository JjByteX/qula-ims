# Qula IMS, Phases Plan

Scope is based on Client-Requests.md and tech-stack.md. This covers accounts, budget, projects, invoices and ARs, activity log, dashboard, and settings. No inventory, stock, or unit of measure work is included.

## Phase 0, Project Setup

### 0.1 Repo and tooling
- Initialize Next.js App Router project with TypeScript
- Set up ESLint and Prettier
- Set up folder structure: app, components, lib, db, types

### 0.2 Styling and components
- Install Tailwind CSS
- Install and configure shadcn/ui
- Add design tokens from Mandatory_Colors.md as Tailwind theme colors
- Set up base layout, typography scale, and spacing scale

### 0.3 Database
- Set up PostgreSQL locally
- Install Drizzle ORM
- Create initial schema files for users, sessions, budget, projects, invoices, activity log
- Set up migration workflow

### 0.4 File storage
- Set up Cloudflare R2 bucket
- Configure upload helper functions for profile pictures and invoice or AR PDFs
- Enforce 2MB limit for profile pictures at the storage layer

### 0.5 Infra
- Write Docker Compose file with app, Postgres, and Caddy
- Confirm local dev can run through Docker Compose
- Document environment variables needed

## Phase 1, Auth and User Management

### 1.1 Session auth
- Implement email and password login
- Implement session cookie handling
- Implement remember me as a longer lived session
- Implement logout

### 1.2 Password reset
- Build forgot password request form
- Generate single use, expiring reset token
- Send reset email
- Build reset password form and token validation

### 1.3 Roles
- Add role field to user table, superadmin or user
- Build role check helper for route handlers and middleware
- Protect superadmin only routes

### 1.4 Self-registration
- Build registration form with all required fields
- Store submission as pending
- Notify superadmin of new pending request

### 1.5 Superadmin approval flow
- Build pending requests list, superadmin only
- Approve action, activates account
- Deny action, removes or archives submission

### 1.6 Superadmin direct account creation
- Build create account form for superadmin
- Account is active immediately, no approval step
- Superadmin can hand over login details manually

### 1.7 Profile management
- Build profile view page, viewable by anyone
- Build profile edit page
- Edit access rule: superadmin can edit any profile, a user can edit only their own
- Profile picture upload with 2MB limit, client and server validation

### 1.8 Login page
- Email and password fields
- Remember me checkbox
- Forgot password link
- Basic error states, wrong credentials, locked or pending account

## Phase 2, Budget Module

### 2.1 Allocated funds
- Build allocated funds record, single value per budget period or ongoing
- Build form to set or update allocated funds, editable by any regular user per spec

### 2.2 Actual expenses
- Build expense entity: amount, description, date
- Build create, edit, delete for expenses
- Build expense list view with sorting by date

### 2.3 Remaining budget calculation
- Compute remaining budget as allocated funds minus sum of expenses
- Recalculate automatically whenever expenses or allocated funds change
- Display remaining budget prominently

### 2.4 Budget splitter
- Build equal split logic across team members by default
- Build manual override for custom split percentages or amounts
- Store each person's remaining split
- Recalculate splits when budget or team changes

## Phase 3, Projects, Invoices and ARs

### 3.1 Project entity
- Build project model: title, milestone, price
- Build create, edit, archive for projects
- Build project list view

### 3.2 Invoice and AR
- Build invoice and AR entity linked to a project
- Support doc and PDF file types only
- Upload and store files in R2
- Display invoice and AR on the same page as the linked project

### 3.3 Prefill logic
- When creating an invoice or AR from a project, prefill title, milestone, and price
- Allow editing prefilled values before saving

### 3.4 Status tracking
- Track whether an invoice is paid or unpaid
- Track whether an AR exists for a completed milestone
- Surface this status for use in dashboard flags

## Phase 4, Activity Log

### 4.1 Log schema
- Build activity log table: actor, action type, target entity, target id, timestamp, detail

### 4.2 Log writers
- Add logging calls to account creation, approval, denial, and edits
- Add logging calls to budget changes, allocated funds and expenses
- Add logging calls to project, invoice, and AR changes

### 4.3 Log viewer
- Build full activity log page
- Add filters by actor, action type, and date range
- Add pagination for long histories

## Phase 5, Dashboard

### 5.1 Budget snapshot section
- Show remaining budget as the headline number
- Show allocated versus spent
- Show each person's remaining split if splitter is active

### 5.2 Active projects section
- List ongoing projects with title, milestone, price
- Flag projects with an unpaid invoice
- Flag projects with a pending AR

### 5.3 Pending actions section
- Show registration requests awaiting approval, superadmin view only
- Show finished milestones with no invoice or AR yet

### 5.4 Recent activity section
- Show last 5 to 10 entries from the activity log
- Link to full activity log page

### 5.5 Navigation
- Make every dashboard section link to its full page
- Confirm dashboard view is identical for superadmin and regular users

## Phase 6, Settings

### 6.1 Notification settings
- Build setting for number of days before notification
- Apply this setting wherever notification timing is used

### 6.2 Profile edit shortcut
- Link settings page to the user's own profile edit form

## Phase 7, Polish and Hardening

### 7.1 Access control review
- Audit every route for correct role checks
- Audit every edit action for self versus others rule
- Confirm view access remains open to all roles where specified

### 7.2 UI states
- Add empty states for lists with no data
- Add loading states for async views
- Add error states with retry where relevant

### 7.3 Large screen optimization
- Review layouts at common desktop and large monitor widths
- Adjust spacing and density for large screens rather than mobile first

### 7.4 Monitoring
- Wire up Sentry for error tracking
- Confirm no sensitive business data is sent to Sentry or PostHog
- Wire up PostHog if usage analytics are wanted

### 7.5 Final QA
- Walk through every phase's features end to end
- Confirm calculations, remaining budget and splitter, are correct
- Confirm colors match Mandatory_Colors.md

## Out of Scope

- MFA
- Offline mode or local first sync
- More than two roles or a granular permissions system
- Inventory items, units of measure, stock movement, or POS style ingestion
- Automated tests, deferred until UI and logic are built first
