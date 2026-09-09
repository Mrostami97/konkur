import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import {
  AccessMode,
  Degree,
  Prisma,
  ResourceHostingMode,
  ResourceKind,
  ReviewStatus,
  VersionedEntityType,
} from "@prisma/client";
import type { Readable } from "stream";
import { PrismaService } from "../../prisma/prisma.service";
import { ARTICLE_BLOCK_TYPES, LESSON_BLOCK_TYPES, assertValidContentBlocks } from "../../common/content-blocks";
import { AuditService } from "../audit/audit.service";
import { ObjectStorageService } from "../ingestion/object-storage.service";
import {
  CreateContentSourceDto,
  CreateContributorDto,
  CreateResourceDto,
  PublicResourcesQueryDto,
  SourceLinkDto,
  UpdateContentSourceDto,
  UpdateContributorDto,
  UpdateResourceDto,
} from "./dto/editorial.dto";

const RESOURCE_BLOCK_TYPES = new Set([...ARTICLE_BLOCK_TYPES, ...LESSON_BLOCK_TYPES]);
const EDITABLE_STATUSES: ReviewStatus[] = [ReviewStatus.DRAFT, ReviewStatus.REJECTED];
const EXTERNAL_HOSTING_MODES: ResourceHostingMode[] = [ResourceHostingMode.EXTERNAL_LINK, ResourceHostingMode.OFFICIAL_EMBED];
const PROTECTED_HOSTING_MODES: ResourceHostingMode[] = [ResourceHostingMode.USER_UPLOAD, ResourceHostingMode.MIRRORED_WITH_PERMISSION];
const DOCUMENTED_HOSTING_RIGHTS = new Set(["OWNED_BY_PUBLISHER", "USER_DECLARATION", "SIGNED_PERMISSION", "OPEN_LICENSE"]);
const DOCUMENTED_COMMERCIAL_RIGHTS = new Set(["OWNED_BY_PUBLISHER", "USER_DECLARATION", "SIGNED_PERMISSION", "OPEN_LICENSE"]);

const resourceEditorialInclude = {
  sources: { include: { source: true }, orderBy: { order: "asc" as const } },
  sourceArtifact: true,
  authorProfile: true,
  reviewerProfile: true,
} satisfies Prisma.ResourceInclude;

type ResourceEditorial = Prisma.ResourceGetPayload<{ include: typeof resourceEditorialInclude }>;
const publicResourceInclude = {
  sources: {
    include: {
      source: {
        select: {
          title: true,
          publisher: true,
          canonicalUrl: true,
          deepUrl: true,
          checkedAt: true,
          sourceStatus: true,
          archivedAt: true,
          mayLink: true,
          licenseName: true,
          licenseUrl: true,
          attributionText: true,
        },
      },
    },
    orderBy: { order: "asc" as const },
  },
  authorProfile: { select: { slug: true, displayName: true, roleTitle: true, isPublished: true } },
  reviewerProfile: { select: { slug: true, displayName: true, roleTitle: true, isPublished: true } },
} satisfies Prisma.ResourceInclude;
type PublicResourceRecord = Prisma.ResourceGetPayload<{ include: typeof publicResourceInclude }>;

interface ContentSourceHostingRights {
  archivedAt: Date | null;
  mayHost: boolean;
  rightsBasis: string;
  sourceStatus: string;
}

interface ResourceVersionPayload {
  schema_version: "resource.v1";
  external_id: string | null;
  slug: string;
  title: string;
  summary: string;
  description: string | null;
  kind: ResourceKind;
  access_mode: AccessMode;
  hosting_mode: ResourceHostingMode;
  content_blocks: Prisma.JsonValue;
  external_url: string | null;
  source_artifact_id: string | null;
  taxonomy: {
    degrees: Degree[];
    fields: string[];
    subject_codes: string[];
    topic_codes: string[];
  };
  author_profile_id: string | null;
  metadata: Prisma.JsonValue;
  sources: {
    source_id: string;
    relation: string;
    locator: string | null;
    claim: string | null;
    order: number;
  }[];
}

type ResourceVersion = Prisma.ContentVersionGetPayload<Record<string, never>>;
type ResourceReferenceClient = Pick<
  Prisma.TransactionClient,
  "contentSource" | "contributorProfile" | "sourceArtifact"
>;

type PublishableResource = Pick<
  ResourceEditorial,
  "accessMode" | "contentBlocks" | "externalUrl" | "hostingMode" | "sourceArtifact"
> & {
  sources: {
    source: Pick<
      ResourceEditorial["sources"][number]["source"],
      "archivedAt" | "canonicalUrl" | "commercialUseAllowed" | "deepUrl" | "mayEmbed" | "mayHost" | "mayLink" | "rightsBasis" | "sourceStatus"
    >;
  }[];
};

@Injectable()
export class EditorialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: ObjectStorageService,
  ) {}

  listSources() {
    return this.prisma.contentSource.findMany({ orderBy: { updatedAt: "desc" } });
  }

  async createSource(actorId: string, dto: CreateContentSourceDto) {
    const source = await this.prisma.contentSource.create({ data: this.sourceData(dto) });
    await this.audit.log({ actorUserId: actorId, action: "content_source.created", targetType: "ContentSource", targetId: source.id });
    return source;
  }

  async updateSource(id: string, actorId: string, dto: UpdateContentSourceDto) {
    await this.requireSource(id);
    const source = await this.prisma.contentSource.update({ where: { id }, data: this.sourceData(dto) });
    await this.audit.log({ actorUserId: actorId, action: "content_source.updated", targetType: "ContentSource", targetId: id });
    return source;
  }

  async archiveSource(id: string, actorId: string) {
    await this.requireSource(id);
    const source = await this.prisma.contentSource.update({ where: { id }, data: { archivedAt: new Date(), sourceStatus: "ARCHIVED" } });
    await this.audit.log({ actorUserId: actorId, action: "content_source.archived", targetType: "ContentSource", targetId: id });
    return source;
  }

  listContributors() {
    return this.prisma.contributorProfile.findMany({ orderBy: { updatedAt: "desc" } });
  }

  async createContributor(actorId: string, dto: CreateContributorDto) {
    const profile = await this.prisma.contributorProfile.create({
      data: {
        ...dto,
        bioBlocks: (dto.bioBlocks ?? []) as Prisma.InputJsonValue,
      },
    });
    await this.audit.log({ actorUserId: actorId, action: "contributor.created", targetType: "ContributorProfile", targetId: profile.id });
    return profile;
  }

  async updateContributor(id: string, actorId: string, dto: UpdateContributorDto) {
    const existing = await this.prisma.contributorProfile.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("contributor not found");
    const profile = await this.prisma.contributorProfile.update({
      where: { id },
      data: {
        ...dto,
        bioBlocks: dto.bioBlocks ? (dto.bioBlocks as Prisma.InputJsonValue) : undefined,
      },
    });
    await this.audit.log({ actorUserId: actorId, action: "contributor.updated", targetType: "ContributorProfile", targetId: id });
    return profile;
  }

  async createResource(actorId: string, dto: CreateResourceDto) {
    if (dto.contentBlocks?.length) assertValidContentBlocks(dto.contentBlocks, RESOURCE_BLOCK_TYPES);
    const resource = await this.prisma.$transaction(async (tx) => {
      await this.assertResourceReferenceIds({
        hostingMode: dto.hostingMode,
        externalUrl: dto.externalUrl ?? null,
        sourceArtifactId: dto.sourceArtifactId ?? null,
        authorProfileId: dto.authorProfileId ?? null,
        sourceIds: dto.sources.map((source) => source.sourceId),
      }, tx);
      const created = await tx.resource.create({
        data: {
          externalId: dto.externalId,
          slug: dto.slug,
          title: dto.title,
          summary: dto.summary,
          description: dto.description,
          kind: dto.kind,
          accessMode: dto.accessMode,
          hostingMode: dto.hostingMode,
          contentBlocks: (dto.contentBlocks ?? []) as Prisma.InputJsonValue,
          externalUrl: dto.externalUrl,
          sourceArtifactId: dto.sourceArtifactId,
          taxonomyDegrees: dto.taxonomyDegrees ?? [],
          taxonomyFields: dto.taxonomyFields ?? [],
          subjectCodes: dto.subjectCodes ?? [],
          topicCodes: dto.topicCodes ?? [],
          authorProfileId: dto.authorProfileId,
          metadata: (dto.metadata ?? {}) as Prisma.InputJsonValue,
          sources: { create: dto.sources.map((source) => this.resourceSourceData(source)) },
        },
        include: { sources: true },
      });
      await tx.contentVersion.create({
        data: {
          entityType: VersionedEntityType.RESOURCE,
          entityId: created.id,
          version: 1,
          schemaVersion: "resource.v1",
          reviewStatus: ReviewStatus.DRAFT,
          createdByUserId: actorId,
          payload: this.resourcePayload(created) as unknown as Prisma.InputJsonValue,
        },
      });
      return created;
    });
    await this.audit.log({
      actorUserId: actorId,
      action: "resource.created",
      targetType: "Resource",
      targetId: resource.id,
      metadata: { sourceArtifactId: resource.sourceArtifactId },
    });
    return resource;
  }

  async updateResource(id: string, actorId: string, dto: UpdateResourceDto) {
    const existing = await this.getResourceAdmin(id);
    if (!EDITABLE_STATUSES.includes(existing.reviewStatus)) {
      throw new ForbiddenException("published resources must be revised before editing");
    }
    if (dto.contentBlocks?.length) assertValidContentBlocks(dto.contentBlocks, RESOURCE_BLOCK_TYPES);

    const canonical = await this.getResourceCanonical(id);
    if (existing.version > canonical.version) {
      const revision = await this.findResourceVersion(id, existing.version);
      const previousPayload = this.parseResourcePayload(revision.payload);
      const payload = this.patchResourcePayload(previousPayload, dto);
      this.assertResourceCanonicalIdentity(canonical, payload);
      const updatedRevision = await this.prisma.$transaction(async (tx) => {
        await this.assertResourcePayloadReferences(payload, tx);
        const changed = await tx.contentVersion.updateMany({
          where: { id: revision.id, reviewStatus: { in: EDITABLE_STATUSES } },
          data: {
            payload: payload as unknown as Prisma.InputJsonValue,
            reviewStatus: ReviewStatus.DRAFT,
            reviewNote: null,
            submittedAt: null,
            reviewedByUserId: null,
            reviewedAt: null,
            publishedAt: null,
          },
        });
        if (changed.count !== 1) throw new ForbiddenException("resource revision is no longer editable");
        await this.audit.log({
          actorUserId: actorId,
          action: "resource.revision_updated",
          targetType: "Resource",
          targetId: id,
          metadata: {
            version: revision.version,
            previousSourceArtifactId: previousPayload.source_artifact_id,
            sourceArtifactId: payload.source_artifact_id,
          },
        }, tx);
        return tx.contentVersion.findUniqueOrThrow({ where: { id: revision.id } });
      });
      const updated = await this.resourceVersionView(canonical, updatedRevision);
      return updated;
    }

    const previousPayload = this.resourcePayload(canonical);
    const payload = this.patchResourcePayload(previousPayload, dto);
    this.assertResourceCanonicalIdentity(canonical, payload);
    const updated = await this.prisma.$transaction(async (tx) => {
      await this.assertResourcePayloadReferences(payload, tx);
      const resource = await tx.resource.update({
        where: { id },
        data: {
          title: payload.title,
          summary: payload.summary,
          description: payload.description,
          kind: payload.kind,
          accessMode: payload.access_mode,
          hostingMode: payload.hosting_mode,
          contentBlocks: payload.content_blocks as Prisma.InputJsonValue,
          externalUrl: payload.external_url,
          sourceArtifactId: payload.source_artifact_id,
          taxonomyDegrees: payload.taxonomy.degrees,
          taxonomyFields: payload.taxonomy.fields,
          subjectCodes: payload.taxonomy.subject_codes,
          topicCodes: payload.taxonomy.topic_codes,
          authorProfileId: payload.author_profile_id,
          metadata: payload.metadata as Prisma.InputJsonValue,
          reviewStatus: ReviewStatus.DRAFT,
          sources: {
            deleteMany: {},
            create: payload.sources.map((source) => ({
              sourceId: source.source_id,
              relation: source.relation,
              locator: source.locator,
              claim: source.claim,
              order: source.order,
            })),
          },
        },
        include: { sources: true },
      });
      await tx.contentVersion.upsert({
        where: { entityType_entityId_version: { entityType: VersionedEntityType.RESOURCE, entityId: id, version: resource.version } },
        update: { payload: this.resourcePayload(resource) as unknown as Prisma.InputJsonValue, reviewStatus: ReviewStatus.DRAFT, reviewNote: null },
        create: {
          entityType: VersionedEntityType.RESOURCE,
          entityId: id,
          version: resource.version,
          schemaVersion: "resource.v1",
          reviewStatus: ReviewStatus.DRAFT,
          createdByUserId: actorId,
          payload: this.resourcePayload(resource) as unknown as Prisma.InputJsonValue,
        },
      });
      await this.audit.log({
        actorUserId: actorId,
        action: "resource.updated",
        targetType: "Resource",
        targetId: id,
        metadata: {
          previousSourceArtifactId: previousPayload.source_artifact_id,
          sourceArtifactId: payload.source_artifact_id,
        },
      }, tx);
      return resource;
    });
    return updated;
  }

  async reviseResource(id: string, actorId: string) {
    const existing = await this.getResourceCanonical(id);
    if (existing.reviewStatus !== ReviewStatus.PUBLISHED) throw new ForbiddenException("only published resources can be revised");
    const pending = await this.prisma.contentVersion.findFirst({
      where: { entityType: VersionedEntityType.RESOURCE, entityId: id, version: { gt: existing.version } },
      orderBy: { version: "desc" },
    });
    if (pending) throw new ForbiddenException("this resource already has a pending revision");
    const nextVersion = existing.version + 1;
    const revision = await this.prisma.contentVersion.create({
      data: {
        entityType: VersionedEntityType.RESOURCE,
        entityId: id,
        version: nextVersion,
        schemaVersion: "resource.v1",
        reviewStatus: ReviewStatus.DRAFT,
        createdByUserId: actorId,
        payload: this.resourcePayload(existing) as unknown as Prisma.InputJsonValue,
      },
    });
    await this.audit.log({ actorUserId: actorId, action: "resource.revision_created", targetType: "Resource", targetId: id, metadata: { version: nextVersion } });
    return this.resourceVersionView(existing, revision);
  }

  async submitResource(id: string, actorId: string) {
    const resource = await this.getResourceAdmin(id);
    if (!EDITABLE_STATUSES.includes(resource.reviewStatus)) throw new ForbiddenException("resource is not editable");
    this.assertResourcePublishable(resource);
    const canonical = await this.getResourceCanonical(id);
    const revision = await this.findResourceVersion(id, resource.version);
    const now = new Date();
    const updatedRevision = await this.prisma.$transaction(async (tx) => {
      const changed = await tx.contentVersion.updateMany({
        where: { id: revision.id, reviewStatus: { in: EDITABLE_STATUSES } },
        data: { reviewStatus: ReviewStatus.IN_REVIEW, submittedAt: now },
      });
      if (changed.count !== 1) throw new ForbiddenException("resource revision is no longer editable");
      if (resource.version === canonical.version && canonical.reviewStatus !== ReviewStatus.PUBLISHED) {
        await tx.resource.update({ where: { id }, data: { reviewStatus: ReviewStatus.IN_REVIEW } });
      }
      return tx.contentVersion.findUniqueOrThrow({ where: { id: revision.id } });
    });
    await this.audit.log({ actorUserId: actorId, action: "resource.submitted", targetType: "Resource", targetId: id });
    if (resource.version > canonical.version) return this.resourceVersionView(canonical, updatedRevision);
    return this.getResourceCanonical(id);
  }

  async approveResource(id: string, reviewerUserId: string) {
    const resource = await this.getResourceAdmin(id);
    if (resource.reviewStatus !== ReviewStatus.IN_REVIEW) throw new ForbiddenException("resource is not in review");
    this.assertResourcePublishable(resource);
    const canonical = await this.getResourceCanonical(id);
    const revision = await this.findResourceVersion(id, resource.version);
    const payload = this.parseResourcePayload(revision.payload);
    this.assertResourceCanonicalIdentity(canonical, payload);
    const reviewer = await this.prisma.contributorProfile.findUnique({ where: { userId: reviewerUserId } });
    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.contentVersion.updateMany({
        where: { id: revision.id, reviewStatus: ReviewStatus.IN_REVIEW },
        data: { reviewStatus: ReviewStatus.PUBLISHED, reviewedByUserId: reviewerUserId, reviewedAt: now, publishedAt: now },
      });
      if (claimed.count !== 1) throw new ForbiddenException("resource revision is no longer in review");
      return this.applyResourceVersion(tx, canonical, revision.version, payload, reviewer?.id, now);
    });
    await this.audit.log({
      actorUserId: reviewerUserId,
      action: "resource.approved",
      targetType: "Resource",
      targetId: id,
      metadata: {
        version: revision.version,
        selfReviewed:
          revision.createdByUserId === reviewerUserId ||
          resource.authorProfile?.userId === reviewerUserId,
      },
    });
    return updated;
  }

  async rejectResource(id: string, reviewerUserId: string, reason: string) {
    const resource = await this.getResourceAdmin(id);
    if (resource.reviewStatus !== ReviewStatus.IN_REVIEW) throw new ForbiddenException("resource is not in review");
    const canonical = await this.getResourceCanonical(id);
    const revision = await this.findResourceVersion(id, resource.version);
    const now = new Date();
    const updatedRevision = await this.prisma.$transaction(async (tx) => {
      const changed = await tx.contentVersion.updateMany({
        where: { id: revision.id, reviewStatus: ReviewStatus.IN_REVIEW },
        data: { reviewStatus: ReviewStatus.REJECTED, reviewedByUserId: reviewerUserId, reviewedAt: now, reviewNote: reason },
      });
      if (changed.count !== 1) throw new ForbiddenException("resource revision is no longer in review");
      if (resource.version === canonical.version && canonical.reviewStatus !== ReviewStatus.PUBLISHED) {
        await tx.resource.update({ where: { id }, data: { reviewStatus: ReviewStatus.REJECTED } });
      }
      return tx.contentVersion.findUniqueOrThrow({ where: { id: revision.id } });
    });
    await this.audit.log({ actorUserId: reviewerUserId, action: "resource.rejected", targetType: "Resource", targetId: id, metadata: { reason, version: revision.version } });
    if (resource.version > canonical.version) return this.resourceVersionView(canonical, updatedRevision);
    return this.getResourceCanonical(id);
  }

  async listResourcesAdmin() {
    const resources = await this.prisma.resource.findMany({
      include: resourceEditorialInclude,
      orderBy: { updatedAt: "desc" },
    });
    const items = await Promise.all(resources.map((resource) => this.resourceWithPendingVersion(resource)));
    return items.sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime());
  }

  async getResourceAdmin(id: string) {
    return this.resourceWithPendingVersion(await this.getResourceCanonical(id));
  }

  async listPublishedResources(userId?: string, query: PublicResourcesQueryDto = {}) {
    const reviewedAt = this.resourceReviewDateFilter(query.reviewedFrom, query.reviewedTo);
    const resources = await this.prisma.resource.findMany({
      where: {
        reviewStatus: ReviewStatus.PUBLISHED,
        ...(query.degree ? { taxonomyDegrees: { has: query.degree } } : {}),
        ...(query.field ? { taxonomyFields: { has: query.field } } : {}),
        ...(query.subject ? { subjectCodes: { has: query.subject } } : {}),
        ...(query.topic ? { topicCodes: { has: query.topic } } : {}),
        ...(query.kind ? { kind: query.kind } : {}),
        ...(reviewedAt ? { reviewedAt } : {}),
      },
      include: publicResourceInclude,
      orderBy: { publishedAt: "desc" },
    });
    return Promise.all(resources.map(async (resource) => this.toPublicResource(resource, await this.canAccessResource(userId, resource.id, resource.accessMode))));
  }

  async getPublishedResource(slug: string, userId?: string) {
    const resource = await this.prisma.resource.findUnique({ where: { slug }, include: publicResourceInclude });
    if (!resource || resource.reviewStatus !== ReviewStatus.PUBLISHED) throw new NotFoundException("resource not found");
    return this.toPublicResource(resource, await this.canAccessResource(userId, resource.id, resource.accessMode));
  }

  async getResourceContent(
    slug: string,
    userId?: string,
  ): Promise<
    | { type: "json"; value: { contentBlocks?: unknown; externalUrl?: string } }
    | { type: "stream"; stream: Readable; mimeType: string; filename: string }
  > {
    const resource = await this.prisma.resource.findUnique({
      where: { slug },
      include: {
        sourceArtifact: true,
        sources: { include: { source: true } },
      },
    });
    if (!resource || resource.reviewStatus !== ReviewStatus.PUBLISHED) throw new NotFoundException("resource not found");
    const canAccess = await this.canAccessResource(userId, resource.id, resource.accessMode);
    if (!canAccess) {
      if (!userId) throw new UnauthorizedException("sign in or purchase access to this resource");
      throw new ForbiddenException("no active entitlement for this resource");
    }
    if (resource.sourceArtifact) {
      if (
        !PROTECTED_HOSTING_MODES.includes(resource.hostingMode) ||
        !this.hasDocumentedHostingRights(resource.sources)
      ) {
        throw new NotFoundException("resource content is not available");
      }
      return {
        type: "stream",
        stream: await this.storage.getObjectStream(resource.sourceArtifact.storageKey),
        mimeType: resource.sourceArtifact.mimeType,
        filename: resource.sourceArtifact.filename,
      };
    }
    if (
      resource.externalUrl &&
      EXTERNAL_HOSTING_MODES.includes(resource.hostingMode)
    ) {
      if (
        resource.hostingMode === ResourceHostingMode.EXTERNAL_LINK &&
        !this.hasActiveLinkPermission(resource.sources, resource.externalUrl)
      ) {
        throw new NotFoundException("resource content is not available");
      }
      return { type: "json", value: { externalUrl: resource.externalUrl } };
    }
    return { type: "json", value: { contentBlocks: resource.contentBlocks } };
  }

  async canAccessResource(userId: string | undefined, resourceId: string, accessMode: AccessMode) {
    if (accessMode === AccessMode.PUBLIC) return true;
    if (accessMode === AccessMode.ACCOUNT) return Boolean(userId);
    if (!userId) return false;
    const now = new Date();
    return Boolean(
      await this.prisma.entitlement.findFirst({
        where: {
          userId,
          startAt: { lte: now },
          revokedAt: null,
          OR: [{ endAt: null }, { endAt: { gt: now } }],
          product: { resourceGrants: { some: { resourceId } } },
        },
        select: { id: true },
      }),
    );
  }

  private async getResourceCanonical(id: string): Promise<ResourceEditorial> {
    const resource = await this.prisma.resource.findUnique({
      where: { id },
      include: resourceEditorialInclude,
    });
    if (!resource) throw new NotFoundException("resource not found");
    return resource;
  }

  private async resourceWithPendingVersion(resource: ResourceEditorial) {
    const pending = await this.prisma.contentVersion.findFirst({
      where: {
        entityType: VersionedEntityType.RESOURCE,
        entityId: resource.id,
        version: { gt: resource.version },
      },
      orderBy: { version: "desc" },
    });
    return pending ? this.resourceVersionView(resource, pending) : resource;
  }

  private async resourceVersionView(canonical: ResourceEditorial, revision: ResourceVersion) {
    const payload = this.parseResourcePayload(revision.payload);
    this.assertResourceCanonicalIdentity(canonical, payload);
    const sourceIds = payload.sources.map((source) => source.source_id);
    const [sourceRecords, sourceArtifact, authorProfile, reviewerProfile] = await Promise.all([
      this.prisma.contentSource.findMany({ where: { id: { in: sourceIds } } }),
      payload.source_artifact_id
        ? this.prisma.sourceArtifact.findUnique({ where: { id: payload.source_artifact_id } })
        : Promise.resolve(null),
      payload.author_profile_id
        ? this.prisma.contributorProfile.findUnique({ where: { id: payload.author_profile_id } })
        : Promise.resolve(null),
      revision.reviewedByUserId
        ? this.prisma.contributorProfile.findUnique({ where: { userId: revision.reviewedByUserId } })
        : Promise.resolve(null),
    ]);
    const sourceById = new Map(sourceRecords.map((source) => [source.id, source]));
    if (sourceById.size !== new Set(sourceIds).size) {
      throw new BadRequestException("resource revision references a missing content source");
    }
    if (payload.source_artifact_id && !sourceArtifact) {
      throw new BadRequestException("resource revision references a missing source artifact");
    }
    if (payload.author_profile_id && !authorProfile) {
      throw new BadRequestException("resource revision references a missing contributor profile");
    }
    return {
      ...canonical,
      externalId: payload.external_id,
      slug: payload.slug,
      title: payload.title,
      summary: payload.summary,
      description: payload.description,
      kind: payload.kind,
      accessMode: payload.access_mode,
      hostingMode: payload.hosting_mode,
      contentBlocks: payload.content_blocks,
      externalUrl: payload.external_url,
      sourceArtifactId: payload.source_artifact_id,
      sourceArtifact,
      taxonomyDegrees: payload.taxonomy.degrees,
      taxonomyFields: payload.taxonomy.fields,
      subjectCodes: payload.taxonomy.subject_codes,
      topicCodes: payload.taxonomy.topic_codes,
      authorProfileId: payload.author_profile_id,
      authorProfile,
      reviewerProfileId: reviewerProfile?.id ?? null,
      reviewerProfile,
      reviewStatus: revision.reviewStatus,
      version: revision.version,
      reviewedAt: revision.reviewedAt,
      updatedAt: revision.updatedAt,
      sources: payload.sources.map((source) => ({
        resourceId: canonical.id,
        sourceId: source.source_id,
        relation: source.relation,
        locator: source.locator,
        claim: source.claim,
        order: source.order,
        source: sourceById.get(source.source_id)!,
      })),
    };
  }

  private async findResourceVersion(resourceId: string, version: number) {
    const revision = await this.prisma.contentVersion.findUnique({
      where: {
        entityType_entityId_version: {
          entityType: VersionedEntityType.RESOURCE,
          entityId: resourceId,
          version,
        },
      },
    });
    if (!revision) throw new NotFoundException("resource revision not found");
    if (revision.schemaVersion !== "resource.v1") throw new BadRequestException("unsupported resource revision schema");
    return revision;
  }

  private patchResourcePayload(payload: ResourceVersionPayload, dto: UpdateResourceDto): ResourceVersionPayload {
    const next = {
      ...payload,
      title: dto.title ?? payload.title,
      summary: dto.summary ?? payload.summary,
      description: dto.description ?? payload.description,
      kind: dto.kind ?? payload.kind,
      access_mode: dto.accessMode ?? payload.access_mode,
      hosting_mode: dto.hostingMode ?? payload.hosting_mode,
      content_blocks: dto.contentBlocks !== undefined
        ? (dto.contentBlocks as Prisma.InputJsonValue)
        : payload.content_blocks,
      external_url: dto.externalUrl !== undefined ? dto.externalUrl : payload.external_url,
      source_artifact_id: dto.sourceArtifactId !== undefined ? dto.sourceArtifactId : payload.source_artifact_id,
      taxonomy: {
        degrees: dto.taxonomyDegrees ?? payload.taxonomy.degrees,
        fields: dto.taxonomyFields ?? payload.taxonomy.fields,
        subject_codes: dto.subjectCodes ?? payload.taxonomy.subject_codes,
        topic_codes: dto.topicCodes ?? payload.taxonomy.topic_codes,
      },
      author_profile_id: dto.authorProfileId !== undefined ? dto.authorProfileId : payload.author_profile_id,
      metadata: dto.metadata !== undefined
        ? (dto.metadata as Prisma.InputJsonValue)
        : payload.metadata,
      sources: dto.sources
        ? dto.sources.map((source) => ({
            source_id: source.sourceId,
            relation: source.relation,
            locator: source.locator ?? null,
            claim: source.claim ?? null,
            order: source.order ?? 0,
          }))
        : payload.sources,
    };
    return this.parseResourcePayload(next as unknown as Prisma.JsonValue);
  }

  private parseResourcePayload(value: Prisma.JsonValue): ResourceVersionPayload {
    if (!this.isRecord(value) || value.schema_version !== "resource.v1") {
      throw new BadRequestException("invalid resource.v1 revision payload");
    }
    const taxonomy = value.taxonomy;
    const sources = value.sources;
    const contentBlocks = value.content_blocks;
    const resourceKinds = new Set<string>(Object.values(ResourceKind));
    const accessModes = new Set<string>(Object.values(AccessMode));
    const hostingModes = new Set<string>(Object.values(ResourceHostingMode));
    const degrees = new Set<string>(Object.values(Degree));
    const nullableString = (candidate: unknown) => candidate === null || typeof candidate === "string";
    const validSources = Array.isArray(sources) && sources.every((source) =>
      this.isRecord(source) &&
      typeof source.source_id === "string" && source.source_id.length > 0 &&
      typeof source.relation === "string" && source.relation.length > 0 &&
      nullableString(source.locator) && nullableString(source.claim) &&
      typeof source.order === "number" && Number.isInteger(source.order),
    );
    if (
      typeof value.slug !== "string" || value.slug.length === 0 ||
      typeof value.title !== "string" || value.title.length === 0 ||
      typeof value.summary !== "string" || value.summary.length === 0 ||
      !nullableString(value.external_id) || !nullableString(value.description) ||
      !nullableString(value.external_url) || !nullableString(value.source_artifact_id) ||
      !nullableString(value.author_profile_id) ||
      typeof value.kind !== "string" || !resourceKinds.has(value.kind) ||
      typeof value.access_mode !== "string" || !accessModes.has(value.access_mode) ||
      typeof value.hosting_mode !== "string" || !hostingModes.has(value.hosting_mode) ||
      !this.isRecord(value.metadata) ||
      !Array.isArray(contentBlocks) ||
      !this.isRecord(taxonomy) ||
      !this.isStringArray(taxonomy.degrees) || !taxonomy.degrees.every((degree) => degrees.has(degree)) ||
      !this.isStringArray(taxonomy.fields) ||
      !this.isStringArray(taxonomy.subject_codes) ||
      !this.isStringArray(taxonomy.topic_codes) ||
      !validSources
    ) {
      throw new BadRequestException("invalid resource.v1 revision payload");
    }
    if (new Set(sources.map((source) => (source as Record<string, unknown>).source_id)).size !== sources.length) {
      throw new BadRequestException("resource sources must be unique");
    }
    if (contentBlocks.length) assertValidContentBlocks(contentBlocks, RESOURCE_BLOCK_TYPES);
    return value as unknown as ResourceVersionPayload;
  }

  private assertResourceCanonicalIdentity(canonical: ResourceEditorial, payload: ResourceVersionPayload) {
    if (payload.slug !== canonical.slug || payload.external_id !== canonical.externalId) {
      throw new BadRequestException("resource revisions cannot change slug or external_id");
    }
  }

  private async assertResourcePayloadReferences(
    payload: ResourceVersionPayload,
    db: ResourceReferenceClient = this.prisma,
  ) {
    await this.assertResourceReferenceIds({
      hostingMode: payload.hosting_mode,
      externalUrl: payload.external_url,
      sourceArtifactId: payload.source_artifact_id,
      authorProfileId: payload.author_profile_id,
      sourceIds: payload.sources.map((source) => source.source_id),
    }, db);
  }

  private async assertResourceReferenceIds(input: {
    hostingMode: ResourceHostingMode;
    externalUrl: string | null;
    sourceArtifactId: string | null;
    authorProfileId: string | null;
    sourceIds: string[];
  }, db: ResourceReferenceClient = this.prisma) {
    if (new Set(input.sourceIds).size !== input.sourceIds.length) {
      throw new BadRequestException("resource sources must be unique");
    }
    const [sourceRecords, sourceArtifact, authorProfile] = await Promise.all([
      db.contentSource.findMany({ where: { id: { in: input.sourceIds } } }),
      input.sourceArtifactId
        ? db.sourceArtifact.findUnique({ where: { id: input.sourceArtifactId }, select: { id: true } })
        : Promise.resolve(null),
      input.authorProfileId
        ? db.contributorProfile.findUnique({ where: { id: input.authorProfileId }, select: { id: true } })
        : Promise.resolve(null),
    ]);
    if (sourceRecords.length !== input.sourceIds.length) {
      throw new BadRequestException("resource revision references a missing content source");
    }
    if (input.sourceArtifactId && !sourceArtifact) {
      throw new BadRequestException("resource revision references a missing source artifact");
    }
    if (input.authorProfileId && !authorProfile) {
      throw new BadRequestException("resource revision references a missing contributor profile");
    }
    if (sourceArtifact && !PROTECTED_HOSTING_MODES.includes(input.hostingMode)) {
      throw new BadRequestException("artifacts can only be attached to protected hosted resources");
    }
    if (input.externalUrl && !EXTERNAL_HOSTING_MODES.includes(input.hostingMode)) {
      throw new BadRequestException("externalUrl can only be attached to external-link or official-embed resources");
    }
    if (sourceArtifact && !this.hasDocumentedHostingRights(sourceRecords.map((source) => ({ source })))) {
      throw new BadRequestException("attaching an artifact requires active, explicit and documented hosting rights");
    }
  }

  private async applyResourceVersion(
    tx: Prisma.TransactionClient,
    canonical: ResourceEditorial,
    version: number,
    payload: ResourceVersionPayload,
    reviewerProfileId: string | undefined,
    now: Date,
  ) {
    this.assertResourceCanonicalIdentity(canonical, payload);
    const sourceIds = payload.sources.map((source) => source.source_id);
    const sourceRecords = await tx.contentSource.findMany({ where: { id: { in: sourceIds } } });
    const sourceArtifact = payload.source_artifact_id
      ? await tx.sourceArtifact.findUnique({ where: { id: payload.source_artifact_id } })
      : null;
    const authorProfile = payload.author_profile_id
      ? await tx.contributorProfile.findUnique({ where: { id: payload.author_profile_id } })
      : null;
    const sourceById = new Map(sourceRecords.map((source) => [source.id, source]));
    if (sourceById.size !== new Set(sourceIds).size) {
      throw new BadRequestException("resource revision references a missing content source");
    }
    if (payload.source_artifact_id && !sourceArtifact) {
      throw new BadRequestException("resource revision references a missing source artifact");
    }
    if (payload.author_profile_id && !authorProfile) {
      throw new BadRequestException("resource revision references a missing contributor profile");
    }
    this.assertResourcePublishable({
      accessMode: payload.access_mode,
      hostingMode: payload.hosting_mode,
      contentBlocks: payload.content_blocks,
      externalUrl: payload.external_url,
      sourceArtifact,
      sources: payload.sources.map((source) => ({ source: sourceById.get(source.source_id)! })),
    });
    return tx.resource.update({
      where: { id: canonical.id },
      data: {
        title: payload.title,
        summary: payload.summary,
        description: payload.description,
        kind: payload.kind,
        accessMode: payload.access_mode,
        hostingMode: payload.hosting_mode,
        contentBlocks: payload.content_blocks as Prisma.InputJsonValue,
        externalUrl: payload.external_url,
        sourceArtifactId: payload.source_artifact_id,
        taxonomyDegrees: payload.taxonomy.degrees,
        taxonomyFields: payload.taxonomy.fields,
        subjectCodes: payload.taxonomy.subject_codes,
        topicCodes: payload.taxonomy.topic_codes,
        authorProfileId: payload.author_profile_id,
        reviewerProfileId,
        reviewedAt: now,
        publishedAt: now,
        metadata: payload.metadata as Prisma.InputJsonValue,
        reviewStatus: ReviewStatus.PUBLISHED,
        version,
        sources: {
          deleteMany: {},
          create: payload.sources.map((source) => ({
            sourceId: source.source_id,
            relation: source.relation,
            locator: source.locator,
            claim: source.claim,
            order: source.order,
          })),
        },
      },
      include: resourceEditorialInclude,
    });
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  private isStringArray(value: unknown): value is string[] {
    return Array.isArray(value) && value.every((item) => typeof item === "string");
  }

  private sourceData(dto: CreateContentSourceDto | UpdateContentSourceDto): Prisma.ContentSourceUncheckedCreateInput {
    return {
      ...dto,
      publishedAt: dto.publishedAt ? new Date(dto.publishedAt) : undefined,
      issuedAt: dto.issuedAt ? new Date(dto.issuedAt) : undefined,
      checkedAt: dto.checkedAt ? new Date(dto.checkedAt) : undefined,
      metadata: dto.metadata ? (dto.metadata as Prisma.InputJsonValue) : undefined,
    } as Prisma.ContentSourceUncheckedCreateInput;
  }

  private resourceSourceData(source: SourceLinkDto) {
    return { sourceId: source.sourceId, relation: source.relation, locator: source.locator, claim: source.claim, order: source.order ?? 0 };
  }

  private resourcePayload(resource: {
    externalId: string | null;
    slug: string;
    title: string;
    summary: string;
    description: string | null;
    kind: ResourceKind;
    accessMode: AccessMode;
    hostingMode: ResourceHostingMode;
    contentBlocks: Prisma.JsonValue;
    externalUrl: string | null;
    sourceArtifactId: string | null;
    taxonomyDegrees: Degree[];
    taxonomyFields: string[];
    subjectCodes: string[];
    topicCodes: string[];
    authorProfileId: string | null;
    metadata: Prisma.JsonValue;
    sources: { sourceId: string; relation: string; locator: string | null; claim: string | null; order: number }[];
  }): ResourceVersionPayload {
    return {
      schema_version: "resource.v1",
      external_id: resource.externalId,
      slug: resource.slug,
      title: resource.title,
      summary: resource.summary,
      description: resource.description,
      kind: resource.kind,
      access_mode: resource.accessMode,
      hosting_mode: resource.hostingMode,
      content_blocks: resource.contentBlocks,
      external_url: resource.externalUrl,
      source_artifact_id: resource.sourceArtifactId,
      taxonomy: {
        degrees: resource.taxonomyDegrees,
        fields: resource.taxonomyFields,
        subject_codes: resource.subjectCodes,
        topic_codes: resource.topicCodes,
      },
      author_profile_id: resource.authorProfileId,
      metadata: resource.metadata,
      sources: resource.sources.map((source) => ({
        source_id: source.sourceId,
        relation: source.relation,
        locator: source.locator,
        claim: source.claim,
        order: source.order,
      })),
    };
  }

  private assertResourcePublishable(resource: PublishableResource) {
    const activeSources = resource.sources.filter(
      (link) => !link.source.archivedAt && link.source.sourceStatus === "ACTIVE",
    );
    if (activeSources.length === 0) throw new BadRequestException("at least one active source is required");
    const hasBlocks = Array.isArray(resource.contentBlocks) && resource.contentBlocks.length > 0;
    if (!hasBlocks && !resource.externalUrl && !resource.sourceArtifact) {
      throw new BadRequestException("resource has no readable content");
    }
    if (resource.hostingMode === ResourceHostingMode.EXTERNAL_LINK && !resource.externalUrl) {
      throw new BadRequestException("externalUrl is required for EXTERNAL_LINK resources");
    }
    if (
      resource.hostingMode === ResourceHostingMode.EXTERNAL_LINK &&
      resource.externalUrl &&
      !this.hasActiveLinkPermission(resource.sources, resource.externalUrl)
    ) {
      throw new BadRequestException("EXTERNAL_LINK resources require an active source that permits and matches the externalUrl");
    }
    if (resource.hostingMode === ResourceHostingMode.OFFICIAL_EMBED) {
      if (!resource.externalUrl || !activeSources.some((link) => link.source.mayEmbed)) {
        throw new BadRequestException("an embeddable source and externalUrl are required");
      }
    }
    if (PROTECTED_HOSTING_MODES.includes(resource.hostingMode)) {
      const hostAllowed = this.hasDocumentedHostingRights(activeSources);
      if (!resource.sourceArtifact || !hostAllowed) {
        throw new BadRequestException("hosted resources require an artifact and documented hosting rights");
      }
    } else if (resource.sourceArtifact) {
      throw new BadRequestException("artifacts can only be attached to protected hosted resources");
    }
    if (resource.externalUrl && !EXTERNAL_HOSTING_MODES.includes(resource.hostingMode)) {
      throw new BadRequestException("externalUrl can only be attached to external-link or official-embed resources");
    }
    if (
      resource.accessMode === AccessMode.ENTITLEMENT &&
      (!resource.sourceArtifact ||
        !PROTECTED_HOSTING_MODES.includes(resource.hostingMode))
    ) {
      throw new BadRequestException("paid resources must use a protected hosted artifact");
    }
    if (resource.accessMode === AccessMode.ENTITLEMENT) {
      const commercialUseDocumented = activeSources.some(
        (link) =>
          link.source.commercialUseAllowed &&
          DOCUMENTED_COMMERCIAL_RIGHTS.has(link.source.rightsBasis),
      );
      if (!commercialUseDocumented) {
        throw new BadRequestException("paid resources require explicit documented commercial-use permission");
      }
    }
  }

  private hasDocumentedHostingRights(
    links: { source: ContentSourceHostingRights }[],
  ) {
    return links.some(
      (link) =>
        !link.source.archivedAt &&
        link.source.sourceStatus === "ACTIVE" &&
        link.source.mayHost &&
        DOCUMENTED_HOSTING_RIGHTS.has(link.source.rightsBasis),
    );
  }

  private async requireSource(id: string) {
    const source = await this.prisma.contentSource.findUnique({ where: { id } });
    if (!source) throw new NotFoundException("content source not found");
    return source;
  }

  private toPublicResource(resource: PublicResourceRecord, canAccess: boolean) {
    const linkPermitted =
      resource.hostingMode !== ResourceHostingMode.EXTERNAL_LINK ||
      Boolean(resource.externalUrl && this.hasActiveLinkPermission(resource.sources, resource.externalUrl));
    const publicSources = resource.sources.filter((link) => this.isActiveLinkableSource(link.source));
    return {
      id: resource.id,
      slug: resource.slug,
      title: resource.title,
      summary: resource.summary,
      description: resource.description,
      kind: resource.kind,
      accessMode: resource.accessMode,
      hostingMode: resource.hostingMode,
      taxonomyDegrees: resource.taxonomyDegrees,
      taxonomyFields: resource.taxonomyFields,
      subjectCodes: resource.subjectCodes,
      topicCodes: resource.topicCodes,
      reviewedAt: resource.reviewedAt,
      publishedAt: resource.publishedAt,
      canAccess: canAccess && linkPermitted,
      externalUrl:
        canAccess && linkPermitted && EXTERNAL_HOSTING_MODES.includes(resource.hostingMode)
          ? resource.externalUrl
          : undefined,
      catalogProfile: this.publicCatalogProfile(resource.metadata),
      sources: publicSources.map((link) => ({
        relation: link.relation,
        locator: link.locator,
        claim: link.claim,
        order: link.order,
        source: {
          title: link.source.title,
          publisher: link.source.publisher,
          canonicalUrl: link.source.canonicalUrl,
          deepUrl: link.source.deepUrl,
          checkedAt: link.source.checkedAt,
          licenseName: link.source.licenseName,
          licenseUrl: link.source.licenseUrl,
          attributionText: link.source.attributionText,
        },
      })),
      authorProfile: resource.authorProfile?.isPublished
        ? { slug: resource.authorProfile.slug, displayName: resource.authorProfile.displayName, roleTitle: resource.authorProfile.roleTitle }
        : null,
      reviewerProfile: resource.reviewerProfile?.isPublished
        ? { slug: resource.reviewerProfile.slug, displayName: resource.reviewerProfile.displayName, roleTitle: resource.reviewerProfile.roleTitle }
        : null,
    };
  }

  private resourceReviewDateFilter(reviewedFrom?: string, reviewedTo?: string): Prisma.DateTimeNullableFilter | undefined {
    if (!reviewedFrom && !reviewedTo) return undefined;
    const from = reviewedFrom ? new Date(`${reviewedFrom}T00:00:00.000Z`) : undefined;
    const toExclusive = reviewedTo ? new Date(`${reviewedTo}T00:00:00.000Z`) : undefined;
    if (toExclusive) toExclusive.setUTCDate(toExclusive.getUTCDate() + 1);
    if (from && toExclusive && from >= toExclusive) {
      throw new BadRequestException("reviewedFrom must not be after reviewedTo");
    }
    return {
      ...(from ? { gte: from } : {}),
      ...(toExclusive ? { lt: toExclusive } : {}),
    };
  }

  private isActiveLinkableSource(source: { archivedAt: Date | null; mayLink: boolean; sourceStatus: string }) {
    return !source.archivedAt && source.sourceStatus === "ACTIVE" && source.mayLink;
  }

  private hasActiveLinkPermission(
    links: { source: { archivedAt: Date | null; canonicalUrl: string; deepUrl: string | null; mayLink: boolean; sourceStatus: string } }[],
    externalUrl: string,
  ) {
    return links.some(
      (link) =>
        this.isActiveLinkableSource(link.source) &&
        (link.source.canonicalUrl === externalUrl || link.source.deepUrl === externalUrl),
    );
  }

  private publicCatalogProfile(metadata: Prisma.JsonValue) {
    if (!this.isRecord(metadata) || !this.isRecord(metadata.catalog)) return null;
    const catalog = metadata.catalog;
    const stringValue = (key: string) => typeof catalog[key] === "string" ? catalog[key] as string : undefined;
    const relatedGuideSlugs = Array.isArray(catalog.relatedGuideSlugs)
      ? [...new Set(catalog.relatedGuideSlugs.filter(
          (value): value is string => typeof value === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value),
        ))].slice(0, 20)
      : [];
    const profile = {
      learningType: stringValue("learningType"),
      startLevel: stringValue("startLevel"),
      coverage: stringValue("coverage"),
      volume: stringValue("volume"),
      sampleLabel: stringValue("sampleLabel"),
      costLabel: stringValue("costLabel"),
      relatedGuideSlugs,
    };
    return Object.values(profile).some((value) => Array.isArray(value) ? value.length > 0 : value !== undefined)
      ? profile
      : null;
  }
}
