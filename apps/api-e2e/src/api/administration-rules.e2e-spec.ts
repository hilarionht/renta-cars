import request from 'supertest';

import { farFutureExpiryDate, futureRentalDates } from '../support/dates';
import { seedAdminForCompany } from '../support/seed-identity';

// docs/persistence/10-DECISIONES.md #140 (Incremento 5, Administracion): reglas encontradas en la
// auditoria en vivo.
// - A/B: datos invalidos dan 400 (no 500) y una operacion que no cambia nada no da 409.
// - C: la company siempre conserva un administrador (409 LAST_ADMINISTRATOR).
// - D: asignar/revocar roles y reactivar usuarios quedan auditados.
// - E: usuario con roles y sucursal valida; PATCH /users/:id; nombre de rol sin mayusculas.
// - F: no se cierra una sucursal con reservas ni se desactiva un rol con usuarios.
// - G/H: politica de cancelacion coherente; auditoria paginada.
// - I: un usuario deshabilitado no renueva la sesion.
describe('Administracion: reglas de usuarios, roles, sucursales y configuracion', () => {
  let baseUrl: string;

  beforeAll(() => {
    baseUrl = process.env.API_E2E_BASE_URL as string;
  });

  it('protege al ultimo administrador, valida los datos y no deja recursos en uso sin aviso', async () => {
    const taxId = `tax-administration-e2e-${Date.now()}`;
    const companyResponse = await request(baseUrl)
      .post('/api/v1/companies')
      .send({
        legalName: `Company administration e2e ${taxId}`,
        taxId,
        billingContactEmail: 'billing@example.com',
      });
    expect(companyResponse.status).toBe(201);
    const companyId: string = companyResponse.body.data.id;

    const admin = await seedAdminForCompany(companyId);
    const login = (email: string, password: string) =>
      request(baseUrl)
        .post('/api/v1/auth/login')
        .set('X-Client-Platform', 'mobile')
        .send({ companyId, email, password });
    const loginResponse = await login(admin.adminEmail, admin.adminPassword);
    expect(loginResponse.status).toBe(201);
    const accessToken: string = loginResponse.body.data.accessToken;
    const auth = (req: request.Test) => req.set('Authorization', `Bearer ${accessToken}`);

    // --- C: el unico administrador no se queda afuera
    const selfRevoke = await auth(
      request(baseUrl).post(`/api/v1/users/${admin.adminUserId}/revoke-role`),
    ).send({ roleId: admin.systemRoleId });
    expect(selfRevoke.status).toBe(409);
    expect(selfRevoke.body.code).toBe('LAST_ADMINISTRATOR');
    const selfDisable = await auth(
      request(baseUrl).post(`/api/v1/users/${admin.adminUserId}/disable`),
    ).send({});
    expect(selfDisable.status).toBe(409);
    expect(selfDisable.body.code).toBe('LAST_ADMINISTRATOR');

    // --- A y E: roles
    const roleResponse = await auth(request(baseUrl).post('/api/v1/roles')).send({
      roleName: 'Mostrador',
      permissions: ['reservations:create'],
    });
    expect(roleResponse.status).toBe(201);
    const roleId: string = roleResponse.body.data.id;
    const caseDuplicate = await auth(request(baseUrl).post('/api/v1/roles')).send({
      roleName: 'MOSTRADOR',
      permissions: ['reservations:create'],
    });
    expect(caseDuplicate.status).toBe(409);
    const unknownPermission = await auth(request(baseUrl).post('/api/v1/roles')).send({
      roleName: 'Raro',
      permissions: ['foo:bar'],
    });
    expect(unknownPermission.status).toBe(400);
    expect(unknownPermission.body.code).toBe('INVALID_VALUE');
    const editSystem = await auth(
      request(baseUrl).patch(`/api/v1/roles/${admin.systemRoleId}/permissions`),
    ).send({ permissions: ['reservations:create'] });
    expect(editSystem.status).toBe(403);

    // --- A y E: sucursales y usuarios
    const branchBody = {
      name: 'Central',
      address: { line1: 'Av. Principal 123', city: 'Buenos Aires', country: 'AR' },
      operatingHours: [{ day: 'monday', open: '08:00', close: '18:00' }],
    };
    const invalidHours = await auth(request(baseUrl).post('/api/v1/branches')).send({
      ...branchBody,
      operatingHours: [{ day: 'monday', open: '18:00', close: '08:00' }],
    });
    expect(invalidHours.status).toBe(400);
    expect(invalidHours.body.code).toBe('INVALID_VALUE');
    const branchResponse = await auth(request(baseUrl).post('/api/v1/branches')).send(branchBody);
    expect(branchResponse.status).toBe(201);
    const branchId: string = branchResponse.body.data.id;
    const closedBranchResponse = await auth(request(baseUrl).post('/api/v1/branches')).send({
      ...branchBody,
      name: 'Norte',
    });
    const closedBranchId: string = closedBranchResponse.body.data.id;
    expect(
      (await auth(request(baseUrl).post(`/api/v1/branches/${closedBranchId}/close`))).status,
    ).toBe(201);
    // B: cerrar una sucursal ya cerrada no da 409.
    expect(
      (await auth(request(baseUrl).post(`/api/v1/branches/${closedBranchId}/close`))).status,
    ).toBe(201);

    const password = 'Operador-e2e-12345';
    const createUser = (email: string, extra: object) =>
      auth(request(baseUrl).post('/api/v1/users')).send({
        email,
        password,
        name: 'Operador e2e',
        roles: [roleId],
        ...extra,
      });
    expect((await createUser('sin-roles@example.com', { roles: [] })).status).toBe(400);
    const inClosedBranch = await createUser('cerrada@example.com', { branchId: closedBranchId });
    expect(inClosedBranch.status).toBe(422);
    expect(inClosedBranch.body.code).toBe('INVALID_BRANCH_ASSIGNMENT');
    const operatorResponse = await createUser('operador@example.com', { branchId });
    expect(operatorResponse.status).toBe(201);
    const operatorId: string = operatorResponse.body.data.id;

    const rename = await auth(request(baseUrl).patch(`/api/v1/users/${operatorId}`)).send({
      name: 'Operador Renombrado',
      branchId: null,
    });
    expect(rename.status).toBe(200);
    const operatorDetail = await auth(request(baseUrl).get(`/api/v1/users/${operatorId}`));
    expect(operatorDetail.body.data.name).toBe('Operador Renombrado');
    expect(operatorDetail.body.data.branchId).toBeUndefined();

    // --- F: rol con usuarios
    const deactivateInUse = await auth(request(baseUrl).post(`/api/v1/roles/${roleId}/deactivate`));
    expect(deactivateInUse.status).toBe(409);
    expect(deactivateInUse.body.code).toBe('ROLE_HAS_USERS');

    // --- I y B: un usuario deshabilitado no renueva la sesion; deshabilitar dos veces no da 409
    const operatorLogin = await login('operador@example.com', password);
    expect(operatorLogin.status).toBe(201);
    const refreshToken: string = operatorLogin.body.data.refreshToken;
    const disable = auth(request(baseUrl).post(`/api/v1/users/${operatorId}/disable`));
    expect((await disable.send({ reason: 'e2e' })).status).toBe(201);
    expect(
      (await auth(request(baseUrl).post(`/api/v1/users/${operatorId}/disable`)).send({})).status,
    ).toBe(201);
    const refresh = await request(baseUrl)
      .post('/api/v1/auth/refresh')
      .set('X-Client-Platform', 'mobile')
      .send({ refreshToken });
    expect(refresh.status).toBe(403);
    expect(refresh.body.code).toBe('USER_DISABLED');
    expect(
      (await auth(request(baseUrl).post(`/api/v1/users/${operatorId}/reactivate`))).status,
    ).toBe(201);

    // --- F: sucursal con una reserva confirmada
    const categoryResponse = await auth(request(baseUrl).post('/api/v1/vehicle-categories')).send({
      name: 'Economico administration e2e',
    });
    const categoryId: string = categoryResponse.body.data.id;
    await auth(request(baseUrl).post(`/api/v1/vehicle-categories/${categoryId}/rates`)).send({
      amountMinorUnits: 50000,
      currency: 'USD',
      unit: 'Day',
      validFrom: '2026-01-01T00:00:00.000Z',
    });
    const vehicleResponse = await auth(request(baseUrl).post('/api/v1/vehicles')).send({
      branchId,
      vehicleCategoryId: categoryId,
      licensePlate: 'ADM-0001',
      vin: '3HGCM82633A555666',
    });
    const vehicleId: string = vehicleResponse.body.data.id;
    const vehicleDocument = await auth(
      request(baseUrl).post(`/api/v1/vehicles/${vehicleId}/documents`),
    ).send({ documentType: 'Insurance', fileId: 'file-e2e', expiryDate: farFutureExpiryDate() });
    await auth(
      request(baseUrl).post(
        `/api/v1/vehicles/${vehicleId}/documents/${vehicleDocument.body.data.id}/verify`,
      ),
    );
    expect((await auth(request(baseUrl).post(`/api/v1/vehicles/${vehicleId}/enable`))).status).toBe(
      201,
    );
    const customerResponse = await auth(request(baseUrl).post('/api/v1/customers')).send({
      name: 'Cliente Administracion',
      taxIdOrDocumentId: `doc-${taxId}`,
      contactEmail: 'cliente-admin@example.com',
      contactPhone: '+5491100000777',
      customerType: 'Individual',
    });
    const customerId: string = customerResponse.body.data.id;
    const customerDocument = await auth(
      request(baseUrl).post(`/api/v1/customers/${customerId}/identity-documents`),
    ).send({ documentType: 'NationalId', fileId: 'file-e2e', expiryDate: farFutureExpiryDate() });
    await auth(
      request(baseUrl).post(
        `/api/v1/customers/${customerId}/identity-documents/${customerDocument.body.data.id}/verify`,
      ),
    );
    const reservationResponse = await auth(request(baseUrl).post('/api/v1/reservations')).send({
      customerId,
      vehicleId,
      ...futureRentalDates(),
    });
    const reservationId: string = reservationResponse.body.data.id;
    expect(
      (await auth(request(baseUrl).post(`/api/v1/reservations/${reservationId}/confirm`))).status,
    ).toBe(201);

    const closeInUse = await auth(request(baseUrl).post(`/api/v1/branches/${branchId}/close`));
    expect(closeInUse.status).toBe(409);
    expect(closeInUse.body.code).toBe('BRANCH_HAS_ACTIVE_RESERVATIONS');
    expect(closeInUse.body.detail).toContain(reservationId);

    // --- G: politica de cancelacion
    const incoherent = await auth(
      request(baseUrl).patch('/api/v1/company-settings/cancellation-policy'),
    ).send({
      tiers: [
        { minHoursBeforeStart: 48, penaltyPercentage: 80 },
        { minHoursBeforeStart: 0, penaltyPercentage: 10 },
      ],
    });
    expect(incoherent.status).toBe(400);
    const emptyTiers = await auth(
      request(baseUrl).patch('/api/v1/company-settings/cancellation-policy'),
    ).send({ tiers: [] });
    expect(emptyTiers.status).toBe(400);

    // --- D y H: auditoria paginada, con los eventos nuevos
    const deadline = Date.now() + 5000;
    let actions: string[] = [];
    do {
      const audit = await auth(
        request(baseUrl).get(`/api/v1/audit-log?subjectType=User&subjectId=${operatorId}`),
      );
      actions = (audit.body.data as { action: string }[]).map((entry) => entry.action);
      if (actions.includes('UserReactivated.v1') && actions.includes('UserDetailsUpdated.v1')) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    } while (Date.now() < deadline);
    expect(actions).toEqual(
      expect.arrayContaining(['UserReactivated.v1', 'UserDetailsUpdated.v1']),
    );

    const firstPage = await auth(request(baseUrl).get('/api/v1/audit-log?limit=2'));
    expect(firstPage.status).toBe(200);
    expect(firstPage.body.data).toHaveLength(2);
    expect(firstPage.body.meta.nextCursor).toEqual(expect.any(String));
    const secondPage = await auth(
      request(baseUrl).get(
        `/api/v1/audit-log?limit=2&cursor=${encodeURIComponent(firstPage.body.meta.nextCursor)}`,
      ),
    );
    const firstIds = (firstPage.body.data as { id: string }[]).map((entry) => entry.id);
    expect(
      (secondPage.body.data as { id: string }[]).every((entry) => !firstIds.includes(entry.id)),
    ).toBe(true);
  });
});
