# Runbook: rotación de secreto de un proveedor de integración

`docs/technical/07-SECURITY.md §3` pide explícitamente este runbook: "Rotación de secretos de proveedor: procedimiento operativo documentado por proveedor en el runbook correspondiente". Cubre las credenciales de `integration-providers` (Stripe, Mercado Pago, WhatsApp, SendGrid, Twilio, MinIO/S3) — **no** la clave de firma JWT, que ya tiene su propio mecanismo de rotación con ventana de gracia por `kid` completamente diseñado en `docs/technical/07-SECURITY.md §1` y no necesita procedimiento operativo adicional.

## Por qué esto es simple hoy

Todos los adaptadores de `integration-providers` son **lazy-init** — ninguno construye su cliente en el constructor (`apps/api/src/config/notifications.config.ts`, comentario propio del archivo: "ningun adaptador construye su cliente en el constructor... asi que el boot nunca falla por credenciales faltantes"). Rotar una credencial es: cambiar la variable de entorno + un rolling restart de réplicas — nunca requiere código nuevo ni una migración de estado.

## 1. Señal/Síntoma que dispara una rotación

- Credencial comprometida (filtrada en un log, un repo, un incidente de terceros).
- Vencimiento programado del proveedor.
- Rotación de rutina por política de seguridad (frecuencia no fijada en este documento — decisión operativa, no arquitectónica).

## 2. Variables de entorno por proveedor

Namespace `payments` (`apps/api/src/config/payments.config.ts`):

| Proveedor    | Variables                                                |
| ------------ | -------------------------------------------------------- |
| Stripe       | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`             |
| Mercado Pago | `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET` |

Namespace `notifications` (`apps/api/src/config/notifications.config.ts`):

| Proveedor                   | Variables                                                                                                    |
| --------------------------- | ------------------------------------------------------------------------------------------------------------ |
| WhatsApp Business Cloud API | `WHATSAPP_API_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`, `WHATSAPP_WEBHOOK_SECRET` |
| SendGrid (email)            | `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`                                                                    |
| Twilio (SMS)                | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`                                              |
| Expo (push)                 | `EXPO_PUSH_ACCESS_TOKEN`                                                                                     |

Namespace `storage` (`apps/api/src/config/storage.config.ts`, MinIO/S3):

| Variable                                                                                           | Uso                                      |
| -------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `STORAGE_ENDPOINT`, `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`, `STORAGE_REGION` | Credenciales del proveedor S3-compatible |

## 3. Procedimiento

1. **Generar la nueva credencial** en el panel del proveedor — nunca revocar la anterior todavía.
2. **Actualizar el almacén de secretos del entorno** (`docs/technical/07-SECURITY.md §3`, `docs/technical/08-DEVOPS.md §5`) — nunca embebido en la imagen, nunca en `.env` versionado. Una imagen sin secretos puede promoverse libremente entre entornos (`docs/technical/08-DEVOPS.md §4`), así que este paso es puramente de configuración del entorno, sin rebuild.
3. **Rolling restart de las réplicas de `apps/api`** — como cualquier cambio de configuración (`docs/technical/08-DEVOPS.md §6`: el balanceador no enruta tráfico a una réplica hasta que `/health/ready` responde `ok`, así que el restart es gateado por salud, sin downtime si hay más de una réplica).
4. **Confirmar que el flujo real del proveedor funciona** con la credencial nueva (ej. un pago de prueba en modo sandbox para Stripe/Mercado Pago, un mensaje de prueba para WhatsApp/SendGrid/Twilio) antes de continuar.
5. **Revocar la credencial anterior** en el panel del proveedor — solo después de confirmar el paso 4, nunca antes (evita una ventana sin credencial válida si el paso 2/3 tuvo un error).
6. **Para un webhook secret** (`STRIPE_WEBHOOK_SECRET`, `MERCADOPAGO_WEBHOOK_SECRET`, `WHATSAPP_WEBHOOK_SECRET`): confirmar que el próximo webhook entrante verifica su firma correctamente (`docs/11-INTEGRACIONES.md §12`: "Toda integración con webhook entrante verifica firma/autenticidad antes de traducir a evento interno") — un webhook secret rotado mal silenciosamente rechaza todo webhook futuro sin que ningún error de negocio lo señale directamente, solo un log de firma inválida.

## 4. Mitigación si algo sale mal

- Si el paso 4 falla (la credencial nueva no funciona): revertir la variable de entorno al valor anterior + rolling restart — la credencial vieja sigue siendo válida hasta el paso 5, así que esto es reversible sin downtime.
- Fallos de un proveedor externo nunca deben poder corromper una transacción de dominio ya confirmada (`docs/11-INTEGRACIONES.md §12`) — una rotación mal hecha que rompe temporalmente un proveedor degrada notificaciones/pagos externos, no el estado de negocio ya confirmado.

## 5. Docs relacionados

- `docs/technical/07-SECURITY.md §1` — rotación de la clave de firma JWT (mecanismo distinto, ya completo, no cubierto por este runbook).
- `docs/technical/07-SECURITY.md §3` — gestión de secretos, mandato de este runbook.
- `docs/11-INTEGRACIONES.md §12` — reglas comunes a toda integración (timeout/reintento, verificación de firma de webhook, credenciales fuera de código).
