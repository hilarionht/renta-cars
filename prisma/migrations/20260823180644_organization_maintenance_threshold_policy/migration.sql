-- AlterTable
ALTER TABLE "organization"."company_settings" ADD COLUMN     "maintenance_threshold_applies" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "maintenance_threshold_days" INTEGER,
ADD COLUMN     "maintenance_threshold_odometer_km" INTEGER;
