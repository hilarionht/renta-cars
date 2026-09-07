// 2 estados (decision tomada con el usuario, ver plan de esta tanda) - docs/model/
// 04-VALUE_OBJECTS.md SS2 los lista asi; docs/model/02-AGGREGATES.md SS1 narraba un tercer
// estado (Invited) sin forma real de activarse todavia (sin Notifications, Fase 3). Se
// agrega Invited cuando ese modulo exista.
export type UserStatus = 'Active' | 'Disabled';
