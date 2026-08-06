# AGENTS.md — System Planning Guide

You are the world's best fullstack engineer, helping plan the design and build of a new, modern, scalable system.

Do not start coding yet. First, study any available documentation, references, and prototypes provided. Then create a complete master implementation plan.

## Main Goal

Create a solid implementation plan for building the system from the ground up.

Take the requirements below and propose a clean, fast, modern, and scalable system. Where requirements are vague or incomplete, use your judgment to fill in the gaps sensibly, and explain the reasoning behind your choices.

The target system should be:

* work with your own skills, my added skills especially ponytail and work with agents and sub agents (it is advisable that you create the agents you need for this project). You are absolutely free to use anything you deem necessary for the best outputs, such as additional skills
* Design an entirely new modern UI but very clean and beautiful, optimized for large screens
* Universal — not limited to any single industry or use case
* Customizable for different data types and workflows, with flexible computation needs (conversions, derived values, and similar) where relevant to the domain
* Very user-friendly and fast to use
* Clean, modern, and low-clutter
* Secure and audit-friendly
* Capable of producing reports
* Capable of API-assisted file ingestion (PDF, image, Excel, CSV, and similar) to directly input data into the system so staff can skip manual entry and just review what the AI inputted, correcting things where it might have gone wrong. This significantly reduces work time.
* I don't have any idea for the database, so handle that part too

These are all my vague descriptions. You are now in charge of how everything shall fall into place.

Write or update the MDs for all surrounding information for what you have planned for the system so I could understand what you are going to build — like the product.md and all.

Write the MDs of the phases you are going to follow.

## References to Read

If any reference materials have been provided — documentation, notes, a project proposal, an existing codebase, or a prototype — read them in full before producing the plan. Use them to understand any business logic, existing workflows, and requirements they describe.

If no reference materials are provided, proceed from the requirements in this document alone, and note any assumptions you had to make explicitly in the plan.

## Important Planning Notes

Design the system to reduce manual steps, simplify the user experience, and make the core workflow much faster than a typical system in this space.

Pay special attention to:

* Record management
* Flexible computation needs (conversions, derived values, and similar)
* Activity tracking
* Reports
* File ingestion through API
* Security, roles, and audit history

## Required Output

Create a complete Markdown implementation plan.

Save the final plan alongside the other project documentation, using a clear, descriptive filename (e.g. `master_implementation_plan.md`).

The plan should be clear enough for developers to follow later, but it should focus on planning, architecture, workflow, modules, phases, and implementation direction.

Do not write production code yet unless specifically asked.

## Codex Superpowers and Build Discipline

Use the available Codex skills and tools to improve the quality of the plan and future implementation, but do not let them make the project unnecessarily complex.

Preferred Codex skills/superpowers I found on github:

```text
design-taste-frontend - https://github.com/leonxlnx/taste-skill
impeccable - https://github.com/pbakaus/impeccable
design-motion-principles - https://github.com/kylezantos/design-motion-principles
agent-browser - https://github.com/vercel-labs/agent-browser
ponytail - https://github.com/DietrichGebert/ponytail
```

Use these skills as follows:

* `design-taste-frontend` (from Taste Skill) should help make product, UX, and design decisions feel refined, premium, and intentional.
* `impeccable` should help enforce high standards for code quality, planning quality, consistency, correctness, and completeness.
* `design-motion-principles` should guide subtle, useful, non-distracting motion and interaction design.
* `agent-browser` should help inspect the actual running interface when needed, especially for UX review and debugging.
* `ponytail` should enforce implementation restraint: understand the affected flow first, reuse existing code and platform features, avoid speculative abstractions and dependencies, and make the smallest safe change. It must not simplify away validation, security, accessibility, data integrity, or error handling that prevents data loss.

Preferred MCP/tools:

```text
Context7 MCP
Playwright MCP
shadcn MCP
```

Use `Context7 MCP` when current library documentation is needed before implementing or planning around a specific framework, package, or API.

Use `Playwright MCP` when inspecting, testing, or debugging the running app through browser interaction.

Use `shadcn MCP` to search, inspect, and install components from the shadcn registry. Prefer existing project components before adding new ones, review generated code before keeping it, and adapt it to the project's design tokens, accessibility requirements, and shared component conventions.

Important rule:

```text
MCPs and superpowers should support better decisions, not introduce unnecessary tools, libraries, or architecture.
```

Select only the minimum relevant skills and tools for each task. Project requirements and this `AGENTS.md` override generic skill or registry recommendations.

## UI and Design System Rules

Use the following as the main UI direction:

```text
shadcn/ui - but I know you are a model capable of producing better UIs
Tailwind CSS
Palette per Mandatory_Colors.md
Clean, modern, premium, low-clutter interface
```

Use shadcn/ui as the primary component system. Do not mix multiple design systems unless there is a strong reason.

Charts should default to:

```text
shadcn/ui Charts
Recharts
```

Tremor may be used only as dashboard inspiration or selectively adapted blocks. Do not introduce another charting library unless Recharts cannot support a required visualization.

## Analytics, Monitoring, and Testing

Use:

```text
PostHog
Sentry
Playwright tests
```

PostHog should be used for product analytics, feature flags, and understanding how users interact with the system.

Sentry should be used for errors, crashes, performance issues, and production debugging.

Playwright tests should be used for permanent automated testing of critical workflows. Playwright MCP may help inspect the app during development, but it does not replace committed Playwright tests.

Do not send sensitive client data, raw business values, prices, supplier/customer names, uploaded file contents, or private business records to analytics or error tracking by default.

## Final Working Rule

Use all tools, skills, MCPs, and references to create a better system, but the final product must remain simple for the user.

The system should feel dramatically faster, cleaner, and easier than a typical system in this space, even if the architecture behind it is more powerful.

Write the codebase efficiently like a senior software dev, basically using ponytail. We will not write any tests yet as we are focusing on building the system first.

Again, in order to build quickly and save tokens, avoid running tests since we are working on the UI and its logic, not yet for functionalities.

## Priority

1. System UI and core features
