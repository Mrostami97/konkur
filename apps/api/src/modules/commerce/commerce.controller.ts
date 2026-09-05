import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { Role } from "@prisma/client";
import { SessionAuthGuard, RequestWithUser } from "../identity/guards/session-auth.guard";
import { RolesGuard } from "../identity/guards/roles.guard";
import { Roles } from "../identity/guards/roles.decorator";
import { CommerceService } from "./commerce.service";
import { CreateProductDto } from "./dto/create-product.dto";
import { CreatePriceDto } from "./dto/create-price.dto";
import { CheckoutDto } from "./dto/checkout.dto";
import { GrantEntitlementDto, RevokeEntitlementDto } from "./dto/grant-entitlement.dto";

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

  @Get("me/entitlements")
  myEntitlements(@Req() req: RequestWithUser) {
    return this.commerce.listMyEntitlements(req.user!.id);
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

  @Post("entitlements/grant")
  @Roles(Role.ADMIN)
  grant(@Req() req: RequestWithUser, @Body() dto: GrantEntitlementDto) {
    return this.commerce.grantManualEntitlement(
      req.user!.id,
      dto.userId,
      dto.productId,
      dto.grantedVia,
      dto.reason,
    );
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
}
