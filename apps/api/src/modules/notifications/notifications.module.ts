import { Global, Module } from "@nestjs/common";
import { IdentityModule } from "../identity/identity.module";
import { NotificationsAdminController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";
import { createSmsGateway, SMS_GATEWAY } from "./sms-gateway";

/** Global so any module can record a message and the login flow can reach
 * the gateway without an import cycle through IdentityModule. */
@Global()
@Module({
  imports: [IdentityModule],
  controllers: [NotificationsAdminController],
  providers: [{ provide: SMS_GATEWAY, useFactory: () => createSmsGateway() }, NotificationsService],
  exports: [SMS_GATEWAY, NotificationsService],
})
export class NotificationsModule {}
