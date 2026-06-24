# Multi-Account Driver OS Design

## Goal

Turn the private Grab tracker into a secure, presentable multi-account Driver OS without exposing Isaac's historical data.

## Account Types

- `owner`: Isaac's private production account and future administration identity.
- `driver`: a registered driver with an isolated, initially empty workspace.
- `demo`: a normal driver workspace seeded with realistic presentation data.

All three account types use the same Driver features. Account type controls ownership and future administration, not the calculation logic.

## Authentication

Supabase Auth handles password hashing, sessions, sign-in, sign-up, and sign-out. The interface may display `Username`, while the implementation maps usernames to a private authentication identifier. Passwords are never stored in source code or application state.

The application shell is hidden until a valid session exists. The `/api/state` endpoint must reject unauthenticated requests.

## Data Isolation

Each `app_state` record belongs to one Supabase Auth user through `user_id`. Row Level Security restricts reads and writes to `auth.uid() = user_id`. The server forwards the signed-in user's bearer token instead of using one shared anonymous identity.

Isaac's current `top1group` state is migrated to the owner account. Demo receives a separate cloned state. New drivers receive `defaultOSState()`.

## Login Experience

The first screen is a premium Driver OS entry, not an admin login template. It includes:

- TOP 1 GROUP MALAYSIA identity
- Driver OS product title
- username and password fields
- Sign In
- Create Driver Account
- Demo presentation access
- clear errors without revealing whether a username exists

## Historical Date Editing

The record date defaults to today but remains selectable. Selecting an existing date loads that record and marks it as `Existing Record`. Saving changes requires an explicit confirmation showing old and new values. The update creates an activity log with before/after snapshots.

## Finish Today Summary

After a successful Finish Today save, a summary modal appears with trips, hours, income, costs, net profit, income per hour, income sources, cost sources, and cash movement:

`Previous Total Cash + Confirmed Cash Collected = New Total Cash`

It also shows:

`Petty Cash + Cash At Home = Total Cash`

Completed calendar days expose `View Daily Summary`.

## Petrol Credit Card Ledger

Each petrol entry stores:

- amount
- station brand, defaulting per driver to `Petron`
- payment method: `Credit Card`, `Cash`, `Points / Rewards`, or `Other`
- optional note

Supported station suggestions include Petron, Petronas, Shell, BHPetrol, Caltex, and Other.

Credit-card petrol creates an outstanding liability. Payments reduce the liability without creating another business cost. The interface shows weekly/monthly petrol cost, total card payments, outstanding balance, and payment history.

## Security Rules

- No password in source code, JSON, logs, or Git.
- No public shared state endpoint.
- No service-role key in browser code.
- RLS enabled on every exposed user-data table.
- Demo and driver accounts can never read the owner row.
