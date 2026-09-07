import type { UnitOfWorkTransaction } from '@platform/shared-kernel';
import type { CustomerOtpChallenge } from '@rental/customers/domain';

export const CUSTOMER_OTP_CHALLENGE_REPOSITORY = Symbol('CustomerOtpChallengeRepository');

export interface CustomerOtpChallengeRepository {
  // El challenge mas reciente basta - RequestCustomerOtpHandler no invalida el anterior al
  // crear uno nuevo (pedir un codigo 2 veces dejando el primero Pending es un caso valido,
  // solo el ultimo importa para verify).
  findLatestForCustomer(
    customerId: string,
    companyId: string,
  ): Promise<CustomerOtpChallenge | null>;
  save(challenge: CustomerOtpChallenge, tx: UnitOfWorkTransaction): Promise<void>;
}
