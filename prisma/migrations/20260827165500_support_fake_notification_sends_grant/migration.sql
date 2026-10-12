-- Infra de test (docs/persistence/10-DECISIONES.md #113) - bug real encontrado por el e2e:
-- la tabla se creo sin RLS a proposito (nunca tenant-scoped, ver comentario del modelo), pero
-- eso NO exime del GRANT - sin el, app_runtime (rol de runtime, no el owner/migrator) no
-- tiene ningun acceso, ni siquiera SELECT/INSERT. FakeNotificationSenderAdapter.send()
-- fallaba con un error de permisos de Postgres, que SendNotificationHandler traducia a
-- NotificationDeliveryFailedError (503) - confuso, parecia un fallo de "entrega" real.
GRANT SELECT, INSERT ON support.fake_notification_sends TO app_runtime;
