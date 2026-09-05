import { Module } from "@nestjs/common";
import { IdentityModule } from "../identity/identity.module";
import { CrmAdminController, DeepLinkController } from "./crm.controller";
import { CrmService } from "./crm.service";

@Module({
  imports: [IdentityModule],
  controllers: [DeepLinkController, CrmAdminController],
  providers: [CrmService],
})
export class CrmModule {}
