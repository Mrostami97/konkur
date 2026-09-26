import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { PaymentStatus, Role } from "@prisma/client";
import { SessionAuthGuard, RequestWithUser } from "../identity/guards/session-auth.guard";
import { RolesGuard } from "../identity/guards/roles.guard";
import { Roles } from "../identity/guards/roles.decorator";
import { CommerceService } from "./commerce.service";
import { CreateProductDto } from "./dto/create-product.dto";
import { CreatePriceDto } from "./dto/create-price.dto";
import { CheckoutDto } from "./dto/checkout.dto";
import { GrantEntitlementDto, RevokeEntitlementDto } from "./dto/grant-entitlement.dto";
import { GrantCourseDto, GrantQuestionBankDto, GrantResourceDto } from "./dto/grant-product-item.dto";
import { RejectPaymentDto, SubmitReceiptDto } from "./dto/submit-receipt.dto";
import { BankAccountDto } from "./dto/bank-account.dto";

@Controller("products")
export class ProductsPublicController {
  constructor(private readonly commerce: CommerceService) {}

  @Get()
  list() {
    return this.commerce.listActiveProducts();
  }

  @Get(":slug")
  getBySlug(@Param("slug") slug: string) {
    return this.commerce.getProductBySlug(slug);
  }
}

@Controller()
@UseGuards(SessionAuthGuard)
export class CommerceStudentController {
  constructor(private readonly commerce: CommerceService) {}

  @Post("checkout")
  checkout(@Req() req: RequestWithUser, @Body() dto: CheckoutDto) {
    return this.commerce.checkout(req.user!.id, dto.productId);
  }

  @Get("me/orders")
  myOrders(@Req() req: RequestWithUser) {
    return this.commerce.listMyOrders(req.user!.id);
  }

  @Get("me/orders/:id")
  myOrder(@Req() req: RequestWithUser, @Param("id") id: string) {
    return this.commerce.getMyOrder(req.user!.id, id);
  }

  @Get("me/entitlements")
  myEntitlements(@Req() req: RequestWithUser) {
    return this.commerce.listMyEntitlements(req.user!.id);
  }

  @Get("me/library")
  myLibrary(@Req() req: RequestWithUser) {
    return this.commerce.listMyLibrary(req.user!.id);
  }

  /** The buyer states they have transferred. This only queues the claim for
   * review; it grants nothing. */
  @Post("me/orders/:id/receipt")
  submitReceipt(@Req() req: RequestWithUser, @Param("id") id: string, @Body() dto: SubmitReceiptDto) {
    return this.commerce.submitReceipt(req.user!.id, id, dto);
  }
}

@Controller("admin")
@UseGuards(SessionAuthGuard, RolesGuard)
export class CommerceAdminController {
  constructor(private readonly commerce: CommerceService) {}

  @Get("products")
  @Roles(Role.ADMIN, Role.FINANCE)
  listProducts() {
    return this.commerce.listAllProducts();
  }

  @Post("products")
  @Roles(Role.ADMIN)
  createProduct(@Req() req: RequestWithUser, @Body() dto: CreateProductDto) {
    return this.commerce.createProduct(req.user!.id, dto);
  }

  @Post("products/:id/prices")
  @Roles(Role.ADMIN)
  addPrice(@Param("id") id: string, @Body() dto: CreatePriceDto) {
    return this.commerce.addPrice(id, dto);
  }

  @Post("products/:id/activate")
  @Roles(Role.ADMIN)
  activateProduct(@Param("id") id: string, @Req() req: RequestWithUser) {
    return this.commerce.setProductActive(req.user!.id, id, true);
  }

  @Post("products/:id/deactivate")
  @Roles(Role.ADMIN)
  deactivateProduct(@Param("id") id: string, @Req() req: RequestWithUser) {
    return this.commerce.setProductActive(req.user!.id, id, false);
  }

  @Delete("products/:id")
  @Roles(Role.ADMIN)
  deleteProduct(@Param("id") id: string, @Req() req: RequestWithUser) {
    return this.commerce.deleteProduct(req.user!.id, id);
  }

  @Post("entitlements/grant")
  @Roles(Role.ADMIN)
  grant(@Req() req: RequestWithUser, @Body() dto: GrantEntitlementDto) {
    return this.commerce.grantManualEntitlement(
      req.user!.id,
      dto.userId,
      dto.productId,
      dto.grantedVia,
      dto.reason,
      dto.startAt ? new Date(dto.startAt) : undefined,
      dto.endAt ? new Date(dto.endAt) : undefined,
    );
  }

  @Post("products/:id/course-grants")
  @Roles(Role.ADMIN)
  addCourseGrant(@Param("id") id: string, @Body() dto: GrantCourseDto) {
    return this.commerce.addCourseGrant(id, dto.courseId);
  }

  @Post("products/:id/resource-grants")
  @Roles(Role.ADMIN)
  addResourceGrant(@Param("id") id: string, @Body() dto: GrantResourceDto) {
    return this.commerce.addResourceGrant(id, dto.resourceId);
  }

  @Post("products/:id/bank-grants")
  @Roles(Role.ADMIN)
  addBankGrant(@Param("id") id: string, @Body() dto: GrantQuestionBankDto) {
    return this.commerce.addBankGrant(id, dto.subjectCode);
  }

  @Post("entitlements/:id/revoke")
  @Roles(Role.ADMIN)
  revoke(@Param("id") id: string, @Req() req: RequestWithUser, @Body() dto: RevokeEntitlementDto) {
    return this.commerce.revokeEntitlement(req.user!.id, id, dto.reason);
  }

  @Get("orders")
  @Roles(Role.ADMIN, Role.FINANCE)
  listOrders() {
    return this.commerce.listAllOrders();
  }

  // --- card transfers --------------------------------------------------------

  @Get("payments")
  @Roles(Role.ADMIN, Role.FINANCE)
  listPayments(@Query("status") status?: PaymentStatus) {
    return this.commerce.listPaymentsForReview(status);
  }

  /** The only path in the card flow that grants access. */
  @Post("payments/:id/confirm")
  @Roles(Role.ADMIN, Role.FINANCE)
  confirmPayment(@Param("id") id: string, @Req() req: RequestWithUser) {
    return this.commerce.confirmPayment(req.user!.id, id);
  }

  @Post("payments/:id/reject")
  @Roles(Role.ADMIN, Role.FINANCE)
  rejectPayment(@Param("id") id: string, @Req() req: RequestWithUser, @Body() dto: RejectPaymentDto) {
    return this.commerce.rejectPayment(req.user!.id, id, dto.reason);
  }

  @Get("bank-accounts")
  @Roles(Role.ADMIN, Role.FINANCE)
  listBankAccounts() {
    return this.commerce.listBankAccounts();
  }

  @Post("bank-accounts")
  @Roles(Role.ADMIN)
  createBankAccount(@Req() req: RequestWithUser, @Body() dto: BankAccountDto) {
    return this.commerce.createBankAccount(req.user!.id, dto);
  }

  @Patch("bank-accounts/:id")
  @Roles(Role.ADMIN)
  updateBankAccount(@Param("id") id: string, @Req() req: RequestWithUser, @Body() dto: BankAccountDto) {
    return this.commerce.updateBankAccount(req.user!.id, id, dto);
  }
}
