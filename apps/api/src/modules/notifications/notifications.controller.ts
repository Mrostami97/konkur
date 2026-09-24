import { Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { Role, SmsStatus } from "@prisma/client";
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { Type } from "class-transformer";
import { SessionAuthGuard } from "../identity/guards/session-auth.guard";
import { RolesGuard } from "../identity/guards/roles.guard";
import { Roles } from "../identity/guards/roles.decorator";
import { NotificationsService } from "./notifications.service";

class ListSmsQuery {
  @IsOptional()
  @IsIn(Object.values(SmsStatus))
  status?: SmsStatus;

  @IsOptional()
  @IsString()
  kind?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

@Controller("admin/notifications")
@UseGuards(SessionAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class NotificationsAdminController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get("status")
  status() {
    return this.notifications.status();
  }

  @Get("sms")
  list(@Query() query: ListSmsQuery) {
    return this.notifications.list(query);
  }

  @Post("sms/:id/retry")
  retry(@Param("id") id: string) {
    return this.notifications.retry(id);
  }
}
