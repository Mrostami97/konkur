import { Body, Controller, Get, NotFoundException, Param, Post, Query, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { LeadStage, Role } from "@prisma/client";
import { SessionAuthGuard } from "../identity/guards/session-auth.guard";
import { RolesGuard } from "../identity/guards/roles.guard";
import { Roles } from "../identity/guards/roles.decorator";
import { CrmService } from "./crm.service";
import { CreateCaseDto } from "./dto/create-case.dto";
import { AddInteractionDto } from "./dto/add-interaction.dto";
import { CreateCampaignDto } from "./dto/create-campaign.dto";

/** Public, unauthenticated: the Telegram/channel deep-link target (doc §8.3). */
@Controller("r")
export class DeepLinkController {
  constructor(private readonly crm: CrmService) {}

  @Get(":code")
  async redirect(@Param("code") code: string, @Res() res: Response) {
    const targetUrl = await this.crm.recordClickAndGetTarget(code).catch(() => null);
    if (!targetUrl) throw new NotFoundException("campaign not found");
    const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:3000";
    const separator = targetUrl.includes("?") ? "&" : "?";
    res.redirect(302, `${frontendUrl}${targetUrl}${separator}campaign=${code}`);
  }
}

@Controller("admin/crm")
@UseGuards(SessionAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.MENTOR)
export class CrmAdminController {
  constructor(private readonly crm: CrmService) {}

  @Get("leads")
  listLeads(@Query("stage") stage?: LeadStage) {
    return this.crm.listLeads(stage);
  }

  @Get("leads/:id")
  getLead(@Param("id") id: string) {
    return this.crm.getLead(id);
  }

  @Post("leads/:id/recompute")
  async recompute(@Param("id") id: string) {
    const lead = await this.crm.getLead(id);
    const stage = await this.crm.recomputeStage(lead.userId);
    return { leadId: id, stage };
  }

  @Post("leads/:id/cases")
  addCase(@Param("id") id: string, @Body() dto: CreateCaseDto) {
    return this.crm.addCase(id, dto);
  }

  @Post("cases/:id/resolve")
  resolveCase(@Param("id") id: string) {
    return this.crm.resolveCase(id);
  }

  @Post("leads/:id/interactions")
  addInteraction(@Param("id") id: string, @Body() dto: AddInteractionDto) {
    return this.crm.addInteraction(id, dto);
  }

  @Get("campaigns")
  listCampaigns() {
    return this.crm.listCampaigns();
  }

  @Post("campaigns")
  createCampaign(@Body() dto: CreateCampaignDto) {
    return this.crm.createCampaign(dto);
  }

  @Get("report")
  getReport() {
    return this.crm.getReport();
  }
}
