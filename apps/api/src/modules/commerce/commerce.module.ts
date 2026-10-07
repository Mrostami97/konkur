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
import { DiscountCodesService } from "./discount-codes.service";

/* The sandbox PaymentProvider that auto-succeeded every charge was deleted
 * with this change rather than left unused. Payment is card-to-card: money
 * arrives in a bank account nothing here can query, and only an operator who
 * has seen the statement may grant access. A stub that returns "paid" without
 * anyone checking is the one thing that must not be reachable from this
 * module, and dead code is reachable code waiting for someone to wire it. */
@Module({
  imports: [AuditModule, IdentityModule, LearningModule],
  controllers: [ProductsPublicController, CommerceStudentController, CommerceAdminController],
  providers: [CommerceService, DiscountCodesService],
  exports: [CommerceService],
})
export class CommerceModule {}
