import { Controller, Get, INestApplication, UseGuards } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { RequestContext, RequiresProductModule } from '@platform/persistence-kernel';
import { SETTINGS_LOOKUP_PORT, type SettingsLookupPort } from '@platform/settings/application';

import { TenantModuleEnabledGuard } from './tenant-module-enabled.guard';

// Primer guard con test propio en este codebase - no hay todavia ninguna ruta real de
// scope:product-rental que proteger (Fase 1 no existe), asi que se prueba con un controller
// sintetico definido aca mismo, nunca tocando la composicion real de apps/api. Verifica el
// mecanismo Reflector + @RequiresProductModule() de punta a punta via HTTP real
// (Test.createTestingModule + supertest), no solo llamando canActivate() a mano con un
// ExecutionContext fabricado.
@Controller('test')
class SyntheticController {
  @RequiresProductModule('Rental')
  @UseGuards(TenantModuleEnabledGuard)
  @Get('gated')
  gated() {
    return { ok: true };
  }

  @UseGuards(TenantModuleEnabledGuard)
  @Get('ungated')
  ungated() {
    return { ok: true };
  }
}

async function buildApp(params: {
  requestContext: { companyId: string } | undefined;
  enabledModules: string[] | null;
}): Promise<INestApplication> {
  const requestContext = {
    tryGet: jest.fn().mockReturnValue(params.requestContext),
  } as unknown as RequestContext;
  const settingsLookup: SettingsLookupPort = {
    getEnabledProductModules: jest.fn().mockResolvedValue(params.enabledModules),
    getCancellationPolicy: jest.fn(),
    getLateReturnPolicy: jest.fn(),
    getDraftExpirationPolicyMinutes: jest.fn(),
    getMinimumBookingLeadTimeMinutes: jest.fn(),
    getDepositPolicy: jest.fn(),
    getPaymentMethodsEnabled: jest.fn(),
    getNotificationChannelPreference: jest.fn(),
  };

  const moduleRef = await Test.createTestingModule({
    controllers: [SyntheticController],
    providers: [
      TenantModuleEnabledGuard,
      { provide: RequestContext, useValue: requestContext },
      { provide: SETTINGS_LOOKUP_PORT, useValue: settingsLookup },
    ],
  }).compile();

  const app = moduleRef.createNestApplication();
  await app.init();
  return app;
}

describe('TenantModuleEnabledGuard', () => {
  it('ruta sin @RequiresProductModule() pasa siempre, sin consultar SettingsLookupPort', async () => {
    const app = await buildApp({ requestContext: { companyId: 'company-a' }, enabledModules: [] });
    try {
      const response = await request(app.getHttpServer()).get('/test/ungated');
      expect(response.status).toBe(200);
    } finally {
      await app.close();
    }
  });

  it('ruta gated sin RequestContext poblado (ruta @Public()) pasa siempre', async () => {
    const app = await buildApp({ requestContext: undefined, enabledModules: null });
    try {
      const response = await request(app.getHttpServer()).get('/test/gated');
      expect(response.status).toBe(200);
    } finally {
      await app.close();
    }
  });

  it('ruta gated con el modulo habilitado pasa', async () => {
    const app = await buildApp({
      requestContext: { companyId: 'company-a' },
      enabledModules: ['Rental'],
    });
    try {
      const response = await request(app.getHttpServer()).get('/test/gated');
      expect(response.status).toBe(200);
    } finally {
      await app.close();
    }
  });

  it('ruta gated con el modulo NO habilitado da 403 PRODUCT_MODULE_NOT_ENABLED', async () => {
    const app = await buildApp({
      requestContext: { companyId: 'company-a' },
      enabledModules: ['Workshop'],
    });
    try {
      const response = await request(app.getHttpServer()).get('/test/gated');
      expect(response.status).toBe(403);
      expect(response.body.code).toBe('PRODUCT_MODULE_NOT_ENABLED');
    } finally {
      await app.close();
    }
  });
});
