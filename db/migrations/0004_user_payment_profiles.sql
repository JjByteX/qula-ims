-- Adds per-user payment profiles and the designated-payer setting
-- (docs/phases-plan-revision-1.md Phase 12). All users columns are
-- nullable — an incomplete payment profile isn't an error. The
-- designated-payer pointer lives on app_settings as a single-row
-- setting, consistent with that table's existing pattern
-- (notification_days_before), rather than as a second table or a flag
-- column on users.

ALTER TABLE "users" ADD COLUMN "payment_qr_code_url" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "payment_method" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "payment_account_name" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "payment_bank" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "payment_account_number" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "payment_signature_url" text;
--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "designated_payer_user_id" uuid;
--> statement-breakpoint
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_designated_payer_user_id_users_id_fk" FOREIGN KEY ("designated_payer_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
