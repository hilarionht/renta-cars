import { Inject, Injectable } from '@nestjs/common';

import {
  DOMAIN_EVENT_PUBLISHER,
  type DomainEventPublisher,
  EntityId,
  UNIT_OF_WORK,
  type UnitOfWork,
} from '@platform/shared-kernel';
import {
  CustomerDeviceContext,
  CustomerRefreshTokenHash,
  CustomerRefreshTokenReusedError,
  CustomerSessionSecurityService,
  InvalidCustomerRefreshTokenError,
} from '@rental/customers/domain';
import { TOKEN_SIGNER, type TokenSigner } from '@platform/identity/application';

import {
  CUSTOMER_REFRESH_TOKEN_HASHER,
  type CustomerRefreshTokenHasher,
} from '../../ports/customer-refresh-token-hasher.port';
import {
  CUSTOMER_SESSION_REPOSITORY,
  type CustomerSessionRepository,
} from '../../ports/customer-session.repository';
import { CUSTOMER_REPOSITORY, type CustomerRepository } from '../../ports/customer.repository';
import type {
  RefreshCustomerSessionCommand,
  RefreshCustomerSessionResult,
} from './refresh-customer-session.command';

// Espejo deliberado de platform/identity/application/src/commands/refresh-session/
// refresh-session.handler.ts - ver customer-session.ts para la razon de la duplicacion.
// A diferencia de RefreshSessionHandler (Session/User en modulos distintos, requiere
// USER_LOOKUP_PORT cross-modulo), CustomerSession y Customer viven en el mismo modulo -
// CUSTOMER_REPOSITORY se inyecta directo, sin puerto publico intermedio.
@Injectable()
export class RefreshCustomerSessionHandler {
  private readonly sessionSecurity = new CustomerSessionSecurityService();

  constructor(
    @Inject(CUSTOMER_SESSION_REPOSITORY)
    private readonly customerSessionRepository: CustomerSessionRepository,
    @Inject(CUSTOMER_REFRESH_TOKEN_HASHER)
    private readonly refreshTokenHasher: CustomerRefreshTokenHasher,
    @Inject(TOKEN_SIGNER) private readonly tokenSigner: TokenSigner,
    @Inject(CUSTOMER_REPOSITORY) private readonly customerRepository: CustomerRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(command: RefreshCustomerSessionCommand): Promise<RefreshCustomerSessionResult> {
    const presentedHash = this.refreshTokenHasher.hash(command.refreshToken);
    const matchedSession =
      await this.customerSessionRepository.findByRefreshTokenHash(presentedHash);

    if (!matchedSession) {
      throw new InvalidCustomerRefreshTokenError();
    }

    const activeSessionsForCustomer = await this.customerSessionRepository.findActiveForCustomer(
      matchedSession.customerId,
      matchedSession.companyId,
    );
    const { hash: newHash, plaintext: newPlaintext } = this.refreshTokenHasher.generate();

    const outcome = this.sessionSecurity.rotate({
      matchedSession,
      activeSessionsForCustomer,
      newRefreshTokenHash: CustomerRefreshTokenHash.fromHash(newHash),
      deviceContext: CustomerDeviceContext.from({
        userAgent: command.userAgent,
        ipAddress: command.ipAddress,
      }),
    });

    await this.unitOfWork.run(async (tx) => {
      for (const session of outcome.sessionsToSave) {
        await this.customerSessionRepository.save(session, tx);
        for (const event of session.pullDomainEvents()) {
          await this.eventPublisher.publish(tx, {
            eventType: event.eventType,
            aggregateType: 'CustomerSession',
            aggregateId: session.id.toString(),
            companyId: session.companyId,
            payload: { ...event },
          });
        }
      }

      if (outcome.theftDetected) {
        await this.eventPublisher.publish(tx, {
          eventType: 'CustomerSessionTheftDetected.v1',
          aggregateType: 'CustomerSession',
          aggregateId: matchedSession.id.toString(),
          companyId: matchedSession.companyId,
          payload: {
            customerId: matchedSession.customerId,
            affectedSessionIds: outcome.sessionsToSave.map((s) => s.id.toString()),
          },
        });
      }
    }, matchedSession.companyId);

    if (outcome.theftDetected || !outcome.newSession) {
      // Nunca se filtra "robo detectado" en la respuesta al cliente - mismo criterio que
      // RefreshSessionHandler (reutiliza el camino de token invalido comun).
      throw new CustomerRefreshTokenReusedError(matchedSession.customerId);
    }

    const customer = await this.customerRepository.findById(
      EntityId.from<'Customer'>(matchedSession.customerId),
    );
    if (!customer) {
      throw new InvalidCustomerRefreshTokenError();
    }

    const accessToken = this.tokenSigner.signAccessToken({
      sub: customer.id.toString(),
      companyId: customer.companyId,
      roles: [],
      actorType: 'Customer',
    });

    return {
      accessToken,
      refreshToken: newPlaintext,
      customerSessionId: outcome.newSession.id.toString(),
    };
  }
}
