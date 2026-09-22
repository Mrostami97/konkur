import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ConsultationBookingStatus, Role } from "@prisma/client";
import { RequestWithUser, SessionAuthGuard } from "../identity/guards/session-auth.guard";
import { RolesGuard } from "../identity/guards/roles.guard";
import { Roles } from "../identity/guards/roles.decorator";
import { ConsultationsService } from "./consultations.service";
import { CreateOfferingDto, UpdateOfferingDto } from "./dto/consultation-offering.dto";
import {
  CancelBookingDto,
  CloseBookingDto,
  ConfirmBookingDto,
  RequestBookingDto,
} from "./dto/consultation-booking.dto";

/** The public catalogue of what instructors offer. Prices and headlines only;
 * nothing about who has booked what. */
@Controller("consultations")
export class ConsultationsPublicController {
  constructor(private readonly consultations: ConsultationsService) {}

  @Get()
  list(@Query("instructor") instructorSlug?: string) {
    return this.consultations.listPublicOfferings(instructorSlug);
  }
}

/** The student's side: what they bought, what is left, and their sessions. */
@Controller("me/consultations")
@UseGuards(SessionAuthGuard)
export class ConsultationsStudentController {
  constructor(private readonly consultations: ConsultationsService) {}

  @Get("access")
  access(@Req() req: RequestWithUser) {
    return this.consultations.listMyAccess(req.user!.id);
  }

  @Get("bookings")
  bookings(@Req() req: RequestWithUser) {
    return this.consultations.listMyBookings(req.user!.id);
  }

  @Post("bookings")
  request(@Req() req: RequestWithUser, @Body() dto: RequestBookingDto) {
    return this.consultations.requestBooking(req.user!.id, dto);
  }

  /** Shared with the instructor: either participant may call a session off,
   * and the service decides which one the caller is. */
  @Post("bookings/:id/cancel")
  cancel(@Req() req: RequestWithUser, @Param("id") id: string, @Body() dto: CancelBookingDto) {
    return this.consultations.cancelBooking(req.user!.id, id, dto.reason);
  }
}

/**
 * The instructor's queue.
 *
 * Session-guarded rather than role-guarded: scope comes from the account being
 * linked to a contributor profile, which the service requires and which is
 * what limits every row to their own bookings.
 */
@Controller("me/instructor/consultations")
@UseGuards(SessionAuthGuard)
export class ConsultationsInstructorController {
  constructor(private readonly consultations: ConsultationsService) {}

  @Get()
  queue(@Req() req: RequestWithUser, @Query("status") status?: ConsultationBookingStatus) {
    return this.consultations.listQueue(req.user!.id, status);
  }

  @Post(":id/confirm")
  confirm(@Req() req: RequestWithUser, @Param("id") id: string, @Body() dto: ConfirmBookingDto) {
    return this.consultations.confirmBooking(req.user!.id, id, dto);
  }

  @Post(":id/complete")
  complete(@Req() req: RequestWithUser, @Param("id") id: string, @Body() dto: CloseBookingDto) {
    return this.consultations.closeBooking(req.user!.id, id, "COMPLETED", dto.instructorNote);
  }

  @Post(":id/no-show")
  noShow(@Req() req: RequestWithUser, @Param("id") id: string, @Body() dto: CloseBookingDto) {
    return this.consultations.closeBooking(req.user!.id, id, "NO_SHOW", dto.instructorNote);
  }

  @Post(":id/cancel")
  cancel(@Req() req: RequestWithUser, @Param("id") id: string, @Body() dto: CancelBookingDto) {
    return this.consultations.cancelBooking(req.user!.id, id, dto.reason);
  }
}

@Controller("admin/consultations")
@UseGuards(SessionAuthGuard, RolesGuard)
export class ConsultationsAdminController {
  constructor(private readonly consultations: ConsultationsService) {}

  @Get("offerings")
  @Roles(Role.ADMIN, Role.FINANCE)
  list() {
    return this.consultations.listOfferingsForAdmin();
  }

  @Post("offerings")
  @Roles(Role.ADMIN)
  create(@Req() req: RequestWithUser, @Body() dto: CreateOfferingDto) {
    return this.consultations.createOffering(req.user!.id, dto);
  }

  @Patch("offerings/:id")
  @Roles(Role.ADMIN)
  update(@Req() req: RequestWithUser, @Param("id") id: string, @Body() dto: UpdateOfferingDto) {
    return this.consultations.updateOffering(req.user!.id, id, dto);
  }
}
