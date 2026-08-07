-- Splits a project's single milestone/price into a proper milestones
-- table, so a project can have many named, individually priced
-- milestones instead of exactly one (see db/schema/projects.ts).
--
-- Existing data is preserved: each project's current milestone/price/
-- milestone_completed becomes that project's first milestone row, and
-- every existing project_document is re-pointed at that seed milestone
-- before milestone_id is made NOT NULL. Safe to run against an empty
-- dev database too — the backfill steps are no-ops when there are no
-- rows to migrate.

CREATE TYPE "public"."milestone_status" AS ENUM('pending', 'completed');
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"title" text NOT NULL,
	"price" numeric(14, 2) NOT NULL,
	"status" "milestone_status" DEFAULT 'pending' NOT NULL,
	"sort_order" numeric(10, 2) DEFAULT '0' NOT NULL,
	"completed_at" timestamp with time zone,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint

-- Backfill: one seed milestone per existing project, carrying over its
-- current milestone title, price, and completed state.
INSERT INTO "milestones" ("project_id", "title", "price", "status", "sort_order", "completed_at", "created_by_user_id", "created_at", "updated_at")
SELECT
	"id",
	"milestone",
	"price",
	CASE WHEN "milestone_completed" THEN 'completed'::"public"."milestone_status" ELSE 'pending'::"public"."milestone_status" END,
	'0',
	CASE WHEN "milestone_completed" THEN "updated_at" ELSE NULL END,
	"created_by_user_id",
	"created_at",
	"updated_at"
FROM "projects";
--> statement-breakpoint

ALTER TABLE "project_documents" ADD COLUMN "milestone_id" uuid;
--> statement-breakpoint

-- Every existing document belonged to the project as a whole under the
-- old one-milestone-per-project model, so it's re-pointed at that
-- project's seed milestone (the only milestone that can exist for it
-- at this point in the migration).
UPDATE "project_documents" pd
SET "milestone_id" = m."id"
FROM "milestones" m
WHERE m."project_id" = pd."project_id";
--> statement-breakpoint

ALTER TABLE "project_documents" ALTER COLUMN "milestone_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "project_documents" ADD CONSTRAINT "project_documents_milestone_id_milestones_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."milestones"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "projects" DROP COLUMN "milestone";
--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "price";
--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "milestone_completed";
