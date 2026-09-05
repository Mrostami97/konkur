import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { IdentityModule } from "../identity/identity.module";
import { LearningModule } from "../learning/learning.module";
import {
  CommerceAdminController,
  CommerceStudentController,
  ProductsPublicController,
} from "./commerce.controller";
import { CommerceService } from "./commerce.service";
import { ManualSandboxPaymentProvider, PAYMENT_PROVIDER } from "./payment-provider";

@Module({
  imports: [AuditModule, IdentityModule, LearningModule],
  controllers: [ProductsPublicController, CommerceStudentController, CommerceAdminController],
  providers: [
    CommerceService,
    { provide: PAYMENT_PROVIDER, useClass: ManualSandboxPaymentProvider },
  ],
  exports: [CommerceService],
})
export class CommerceModule {}
