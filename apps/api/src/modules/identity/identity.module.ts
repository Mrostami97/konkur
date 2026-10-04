import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { IdentityController } from "./identity.controller";
import { AdminController } from "./admin.controller";
import { UserAdminService } from "./user-admin.service";
import { IdentityService } from "./identity.service";
import { OTP_PROVIDER, otpProviderFromEnv } from "./otp-provider";
import { SessionAuthGuard } from "./guards/session-auth.guard";
import { RolesGuard } from "./guards/roles.guard";
import { ProfileController } from "./profile/profile.controller";
import { ProfileService } from "./profile/profile.service";
import { OptionalSessionAuthGuard } from "./guards/optional-session-auth.guard";

@Module({
  imports: [AuditModule],
  controllers: [IdentityController, AdminController, ProfileController],
  providers: [
    IdentityService,
    SessionAuthGuard,
    OptionalSessionAuthGuard,
    RolesGuard,
    ProfileService,
    UserAdminService,
    { provide: OTP_PROVIDER, useFactory: () => otpProviderFromEnv() },
  ],
  exports: [IdentityService, SessionAuthGuard, OptionalSessionAuthGuard, RolesGuard, ProfileService, OTP_PROVIDER],
})
export class IdentityModule {}
