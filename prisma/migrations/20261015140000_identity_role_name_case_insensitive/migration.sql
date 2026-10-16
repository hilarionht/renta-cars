-- docs/persistence/10-DECISIONES.md #140: el nombre de un rol Custom es unico por company sin
-- distinguir mayusculas ("Mostrador" y "mostrador" confundian al asignar). Indice parcial sobre
-- lower(role_name), escrito a mano (Prisma no modela indices por expresion). Falla si ya hay
-- repetidos, a proposito (mismo criterio que #139): hay que resolverlos antes de migrar.
DROP INDEX "identity"."roles_company_id_role_name_custom_key";

CREATE UNIQUE INDEX "roles_company_id_lower_role_name_custom_key" ON "identity"."roles"("company_id", lower("role_name")) WHERE "scope" = 'Custom';
