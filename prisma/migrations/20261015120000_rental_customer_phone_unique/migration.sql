-- docs/persistence/10-DECISIONES.md #139: telefono unico por company (identifica al customer en
-- el login por codigo de WhatsApp).
--
-- 1. Forma canonica (canonicalCustomerPhone): un celular argentino se guarda siempre con el 9
--    de movil. Ningun codigo de area argentino empieza con 9, asi que "+54" seguido de otro
--    digito es la forma sin el 9.
UPDATE "rental"."customers"
SET "contact_phone" = '+549' || substring("contact_phone" from 4)
WHERE "contact_phone" ~ '^[+]54[0-8]';

-- 2. Unicidad. Falla a proposito si hay duplicados (tambien los que aparecen al canonicalizar):
--    es mas seguro resolverlos a mano que deduplicar en silencio.
-- CreateIndex
CREATE UNIQUE INDEX "customers_company_id_contact_phone_key" ON "rental"."customers"("company_id", "contact_phone");
