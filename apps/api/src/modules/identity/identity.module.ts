import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { IdentityController } from "./identity.controller";
import { AdminController } from "./admin.controller";
import { IdentityService } from "./identity.service";
import { ConsoleOtpProvider, OTP_PROVIDER } from "./otp-provider";
import { SessionAuthGuard } from "./guards/session-auth.guard";
import { RolesGuard } from "./guards/roles.guard";
import { ProfileController } from "./profile/profile.controller";
import { ProfileService } from "./profile/profile.service";

@Module({
  imports: [AuditModule],
  controllers: [IdentityController, AdminController, ProfileController],
  providers: [
    IdentityService,
    SessionAuthGuard,
    RolesGuard,
    ProfileService,
    { provide: OTP_PROVIDER, useClass: ConsoleOtpProvider },
  ],
  exports: [IdentityService, SessionAuthGuard, RolesGuard],
})
export class IdentityModule {}
