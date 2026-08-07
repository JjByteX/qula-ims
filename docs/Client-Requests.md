# Qula IMS

## Add/Edit/Archive User

### Who can do what

- Two roles only: superadmin and everyone else. No need for more, it's just 3 people.
- Regular users can edit everything else in the system (projects, budget, invoices, etc.) but not other people's profiles.
- Only superadmin can create new accounts.
- Once a profile is approved, only superadmin or that person can edit it. Nobody else.
- Anyone can view any profile (contact info, description, etc.), but only superadmin can edit someone else's.

### Two ways to create an account

Both roads lead to the same profile, just different starting points.

**1. Self-registration**

- Person fills out their own info and submits it.
- Superadmin approves or denies it.
- Once approved, the account is active.

**2. Superadmin adds someone**

- Superadmin creates the profile directly. Useful for onboarding someone before they've set anything up themselves.
- Superadmin hands over the login details whenever it's convenient.
- No approval step needed here since superadmin already made the account.

Fields (same for both):

- First name
- Middle name
- Last name
- Suffix (if any)
- Contact number
- Email
- Description
- Profile picture (2mb max)

Login is approval-based only. No MFA.

### Login page

- Email and password.
- Remember me option, so the user stays logged in on that device.
- Forgot password link. Sends a reset link to the user's registered email.

## Budget

1. **Allocated Funds**
    - Total budget the company has to work with.
2. **Actual Expenses**
    - Amount
    - Description
    - Date
3. **Remaining Budget**
    - Allocated Funds minus Actual Expenses. Calculated automatically.
4. **Budget Splitter**
    - Splits the budget across team members.
    - Equal split by default, but you can change it.

## Enter Project

Fields:

- Project title
- One or more milestones, each with:
    - Milestone title
    - Price

A project can have as many milestones as the engagement actually has (e.g. "Project Mobilization," "Core Features Completion," "Final Deployment"), each billed separately. The project's total price is the sum of its milestones' prices — not entered directly.

Each milestone acts as a reminder for the user, but its real job is to save you from typing the same info twice when making that milestone's Invoice and Acknowledgement Receipt.

## Invoice & AR

- Lives on the same page as Projects, directly connected.
- Each invoice/AR is tied to one specific milestone, not the project as a whole — a project with several milestones gets a separate invoice/AR per stage as each is billed.
- Docs and PDF only.

## Activity

- Full history. Everything gets logged.

## Dashboard

Kept simple. One glance, no charts just for show. Same view for everyone, superadmin included.

1. **Budget snapshot**
    - Remaining budget (the main number)
    - Allocated vs. spent
    - Each person's remaining split, if the Budget Splitter is on
2. **Active projects**
    - Ongoing projects with title, milestone count, and total price (sum of its milestones)
    - Flags any with an unpaid invoice or a completed milestone still pending its AR
3. **Pending actions**
    - Registration requests waiting on superadmin (superadmin view only)
    - Finished milestones with no invoice or AR made yet (per milestone, not per project)
4. **Recent activity**
    - Last 5 to 10 entries from the Activity log

Everything on the dashboard links straight to its full page.

## Settings
1. Set the number of days before the notification.
2. Profile edit