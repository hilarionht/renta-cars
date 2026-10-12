import { DomainError } from '@platform/shared-kernel';

// Ningun CustomerOtpChallenge Pending y no-expirado para el companyId+phone presentados -
// cubre tanto "nunca se pidio un codigo" como "el codigo expiro" (~5 min, ver plan) bajo un
// unico caso: distinguir ambos al cliente no aporta nada util, la accion es la misma
// (pedir un codigo nuevo).
export class OtpChallengeNotFoundError extends DomainError {
  constructor() {
    super('No hay un codigo vigente para este numero - solicita uno nuevo.');
  }
}
