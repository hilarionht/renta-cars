import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';

import {
  RequestContext,
  RequirePermission,
  RequiresProductModule,
} from '@platform/persistence-kernel';
import {
  BlockCustomerHandler,
  RegisterAdditionalDriverHandler,
  RegisterCustomerHandler,
  RevokeAdditionalDriverHandler,
  UnblockCustomerHandler,
  UpdateCustomerDetailsHandler,
  UploadIdentityDocumentHandler,
  ValidateAdditionalDriverLicenseHandler,
  VerifyIdentityDocumentHandler,
} from '@rental/customers/application';

import { GetCustomerHandler } from '../queries/get-customer.handler';
import { ListCustomersHandler } from '../queries/list-customers.handler';
import { BlockCustomerRequestDto } from './dto/block-customer-request.dto';
import type { CustomerResponseDto } from './dto/customer-response.dto';
import type { CustomerSummaryResponseDto } from './dto/customer-summary-response.dto';
import { RegisterAdditionalDriverRequestDto } from './dto/register-additional-driver-request.dto';
import { RegisterCustomerRequestDto } from './dto/register-customer-request.dto';
import { UpdateCustomerRequestDto } from './dto/update-customer-request.dto';
import { UploadIdentityDocumentRequestDto } from './dto/upload-identity-document-request.dto';

// docs/contracts/02-RESOURCE-CATALOG.md SS4: "customers" siempre escopeado por la company
// del token. Primer consumidor real de @RequiresProductModule() (docs/technical/
// 03-BACKEND-ARCHITECTURE.md SS7, TenantModuleEnabledGuard) - toda la Fase 0 lo dejo sin
// ejercitar.
@RequiresProductModule('Rental')
@Controller('customers')
export class CustomersController {
  constructor(
    private readonly registerCustomer: RegisterCustomerHandler,
    private readonly updateCustomerDetails: UpdateCustomerDetailsHandler,
    private readonly uploadIdentityDocument: UploadIdentityDocumentHandler,
    private readonly verifyIdentityDocument: VerifyIdentityDocumentHandler,
    private readonly registerAdditionalDriver: RegisterAdditionalDriverHandler,
    private readonly validateAdditionalDriverLicense: ValidateAdditionalDriverLicenseHandler,
    private readonly revokeAdditionalDriver: RevokeAdditionalDriverHandler,
    private readonly blockCustomer: BlockCustomerHandler,
    private readonly unblockCustomer: UnblockCustomerHandler,
    private readonly getCustomer: GetCustomerHandler,
    private readonly listCustomers: ListCustomersHandler,
    private readonly requestContext: RequestContext,
  ) {}

  @Post()
  @RequirePermission('customers:create')
  async create(@Body() dto: RegisterCustomerRequestDto): Promise<{ id: string }> {
    const { companyId } = this.requestContext.get();
    const id = await this.registerCustomer.execute({
      companyId,
      name: dto.name,
      taxIdOrDocumentId: dto.taxIdOrDocumentId,
      contactEmail: dto.contactEmail,
      contactPhone: dto.contactPhone,
      customerType: dto.customerType,
    });
    return { id: id.toString() };
  }

  @Get()
  async list(): Promise<CustomerSummaryResponseDto[]> {
    const { companyId } = this.requestContext.get();
    return this.listCustomers.execute({ companyId });
  }

  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<CustomerResponseDto> {
    const { companyId } = this.requestContext.get();
    return this.getCustomer.execute({ customerId: id, companyId });
  }

  @Patch(':id')
  @RequirePermission('customers:edit')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomerRequestDto,
  ): Promise<void> {
    const { companyId } = this.requestContext.get();
    await this.updateCustomerDetails.execute({
      customerId: id,
      companyId,
      name: dto.name,
      contactEmail: dto.contactEmail,
      contactPhone: dto.contactPhone,
    });
  }

  @Post(':id/block')
  @RequirePermission('customers:block')
  async block(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BlockCustomerRequestDto,
  ): Promise<void> {
    const { companyId } = this.requestContext.get();
    await this.blockCustomer.execute({ customerId: id, companyId, reason: dto.reason });
  }

  @Post(':id/unblock')
  @RequirePermission('customers:unblock')
  async unblock(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    const { companyId, userId } = this.requestContext.get();
    await this.unblockCustomer.execute({ customerId: id, companyId, unblockedBy: userId });
  }

  // Ruta plana - el body decide el owner con additionalDriverId opcional (docs/contracts/
  // 02-RESOURCE-CATALOG.md SS4: "customers/{id}/identity-documents", un unico sub-recurso,
  // no anidado 3 niveles bajo additional-drivers).
  @Post(':id/identity-documents')
  @RequirePermission('customers:manage-documents')
  async uploadDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UploadIdentityDocumentRequestDto,
  ): Promise<{ id: string }> {
    const { companyId } = this.requestContext.get();
    const documentId = await this.uploadIdentityDocument.execute({
      customerId: id,
      companyId,
      documentType: dto.documentType,
      fileId: dto.fileId,
      expiryDate: new Date(dto.expiryDate),
      additionalDriverId: dto.additionalDriverId,
    });
    return { id: documentId };
  }

  @Post(':id/identity-documents/:documentId/verify')
  @RequirePermission('customers:verify-documents')
  async verifyDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
  ): Promise<void> {
    const { companyId } = this.requestContext.get();
    await this.verifyIdentityDocument.execute({ customerId: id, companyId, documentId });
  }

  @Post(':id/additional-drivers')
  @RequirePermission('customers:manage-documents')
  async registerDriver(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RegisterAdditionalDriverRequestDto,
  ): Promise<{ id: string }> {
    const { companyId } = this.requestContext.get();
    const driverId = await this.registerAdditionalDriver.execute({
      customerId: id,
      companyId,
      name: dto.name,
    });
    return { id: driverId };
  }

  @Post(':id/additional-drivers/:driverId/validate-license')
  @RequirePermission('customers:verify-documents')
  async validateLicense(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('driverId', ParseUUIDPipe) driverId: string,
  ): Promise<void> {
    const { companyId } = this.requestContext.get();
    await this.validateAdditionalDriverLicense.execute({ customerId: id, companyId, driverId });
  }

  @Post(':id/additional-drivers/:driverId/revoke')
  @RequirePermission('customers:verify-documents')
  async revokeDriver(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('driverId', ParseUUIDPipe) driverId: string,
  ): Promise<void> {
    const { companyId } = this.requestContext.get();
    await this.revokeAdditionalDriver.execute({ customerId: id, companyId, driverId });
  }
}
