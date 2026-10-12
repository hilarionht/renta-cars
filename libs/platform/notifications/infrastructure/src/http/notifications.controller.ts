import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';

import { RequestContext } from '@platform/persistence-kernel';
import type { NotificationSummary } from '@platform/notifications/application';

import { GetNotificationHandler } from '../queries/get-notification.handler';
import { ListNotificationsHandler } from '../queries/list-notifications.handler';

// docs/contracts/02-RESOURCE-CATALOG.md SS6, Hallazgo #4 del plan - solo lectura de
// historial, sin POST: Notification se crea y transiciona exclusivamente por reaccion a
// eventos internos, nunca por mutacion directa de cliente (mismo patron que
// SecurityDeposit.hold()).
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly getNotification: GetNotificationHandler,
    private readonly listNotifications: ListNotificationsHandler,
    private readonly requestContext: RequestContext,
  ) {}

  @Get()
  async list(): Promise<NotificationSummary[]> {
    const { companyId } = this.requestContext.get();
    const result = await this.listNotifications.execute({ companyId });
    return result.items;
  }

  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<NotificationSummary> {
    const { companyId } = this.requestContext.get();
    return this.getNotification.execute({ companyId, notificationId: id });
  }
}
