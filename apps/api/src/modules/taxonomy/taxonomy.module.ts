import { Module } from "@nestjs/common";
import { IdentityModule } from "../identity/identity.module";
import { TaxonomyAdminController, TaxonomyPublicController } from "./taxonomy.controller";
import { TaxonomyService } from "./taxonomy.service";

@Module({
  imports: [IdentityModule],
  controllers: [TaxonomyPublicController, TaxonomyAdminController],
  providers: [TaxonomyService],
  exports: [TaxonomyService],
})
export class TaxonomyModule {}
