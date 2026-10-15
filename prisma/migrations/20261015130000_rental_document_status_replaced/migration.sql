-- docs/persistence/10-DECISIONES.md #139: estado Replaced (documento reemplazado por una
-- renovacion). Migracion aparte a proposito: Postgres no deja USAR un valor de enum en la misma
-- transaccion en que se agrega (precedente: *_notification_kind_*).
-- AlterEnum
ALTER TYPE "rental"."IdentityDocumentStatus" ADD VALUE 'Replaced';

-- AlterEnum
ALTER TYPE "rental"."VehicleDocumentStatus" ADD VALUE 'Replaced';
