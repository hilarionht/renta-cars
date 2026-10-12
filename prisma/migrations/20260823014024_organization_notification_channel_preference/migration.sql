-- CreateEnum
CREATE TYPE "organization"."NotificationChannelDefault" AS ENUM ('WhatsApp', 'Email', 'SMS');

-- AlterTable
ALTER TABLE "organization"."company_settings" ADD COLUMN     "notification_channel_preference" "organization"."NotificationChannelDefault" NOT NULL DEFAULT 'Email';
