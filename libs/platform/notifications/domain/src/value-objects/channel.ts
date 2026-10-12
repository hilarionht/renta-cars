// docs/model/04-VALUE_OBJECTS.md SS7 - catalogo cerrado de 4 valores. A diferencia de
// NotificationChannelPreference (platform-settings-domain, solo 3 - Push queda fuera de la
// preferencia/fallback), este catalogo cubre los 4 canales reales de Notification.
export const CHANNELS = ['WhatsApp', 'Email', 'SMS', 'Push'] as const;

export type ChannelValue = (typeof CHANNELS)[number];
