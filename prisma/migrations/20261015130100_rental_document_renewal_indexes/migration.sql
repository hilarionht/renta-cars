-- docs/persistence/10-DECISIONES.md #139: renovacion de documentos. Antes un solo indice parcial
-- admitia UN documento Pending o Verified por dueno y tipo: no se podia cargar una renovacion
-- mientras el anterior siguiera Pending/Verified (409), asi que un documento vencido no se
-- podia reemplazar nunca. Ahora puede haber a la vez un Pending (la renovacion en revision) y
-- un Verified (el que vale hasta que se verifique la renovacion). Al verificar la nueva, el
-- dominio pasa la anterior a Replaced antes de escribir (ver los repositorios).
--
-- Indices escritos a mano (Prisma no modela indices parciales). No mencionan 'Replaced'
-- (agregado en la migracion anterior, no usable en la misma transaccion).

DROP INDEX "rental"."identity_documents_owner_document_type_active_key";

CREATE UNIQUE INDEX "identity_documents_owner_document_type_pending_key"
  ON "rental"."identity_documents" (COALESCE(customer_id, additional_driver_id), document_type)
  WHERE status = 'Pending';

CREATE UNIQUE INDEX "identity_documents_owner_document_type_verified_key"
  ON "rental"."identity_documents" (COALESCE(customer_id, additional_driver_id), document_type)
  WHERE status = 'Verified';

DROP INDEX "rental"."vehicle_documents_vehicle_id_document_type_active_key";

CREATE UNIQUE INDEX "vehicle_documents_vehicle_id_document_type_pending_key"
  ON "rental"."vehicle_documents" (vehicle_id, document_type)
  WHERE status = 'Pending';

CREATE UNIQUE INDEX "vehicle_documents_vehicle_id_document_type_verified_key"
  ON "rental"."vehicle_documents" (vehicle_id, document_type)
  WHERE status = 'Verified';
