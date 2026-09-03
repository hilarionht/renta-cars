-- AlterTable
ALTER TABLE "organization"."company_settings" ADD COLUMN     "reminder_lead_time_minutes" INTEGER NOT NULL DEFAULT 1440;
