import { Type } from "class-transformer";
import {
  AccessMode,
  ContributorKind,
  Degree,
  ResourceHostingMode,
  ResourceKind,
} from "@prisma/client";
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";

export class SourceLinkDto {
  @IsUUID()
  sourceId!: string;

  @IsString()
  @MinLength(1)
  relation!: string;

  @IsOptional()
  @IsString()
  locator?: string;

  @IsOptional()
  @IsString()
  claim?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}

export class CreateContentSourceDto {
  @IsOptional() @IsString() externalId?: string;
  @IsString() @MinLength(1) kind!: string;
  @IsString() @MinLength(1) title!: string;
  @IsString() @MinLength(1) publisher!: string;
  @IsOptional() @IsString() creator?: string;
  @IsUrl({ require_tld: false }) canonicalUrl!: string;
  @IsOptional() @IsUrl({ require_tld: false }) deepUrl?: string;
  @IsString() @MinLength(1) sourceTier!: string;
  @IsOptional() @IsArray() @IsString({ each: true }) authorityScopes?: string[];
  @IsOptional() @IsString() sourceStatus?: string;
  @IsOptional() @IsDateString() publishedAt?: string;
  @IsOptional() @IsDateString() issuedAt?: string;
  @IsDateString() checkedAt!: string;
  @IsOptional() @IsString() rightsHolder?: string;
  @IsOptional() @IsString() rightsBasis?: string;
  @IsOptional() @IsString() licenseName?: string;
  @IsOptional() @IsUrl({ require_tld: false }) licenseUrl?: string;
  @IsOptional() @IsString() attributionText?: string;
  @IsOptional() @IsBoolean() mayLink?: boolean;
  @IsOptional() @IsBoolean() mayEmbed?: boolean;
  @IsOptional() @IsBoolean() mayQuote?: boolean;
  @IsOptional() @IsBoolean() mayReproduce?: boolean;
  @IsOptional() @IsBoolean() mayAdapt?: boolean;
  @IsOptional() @IsBoolean() mayTranslate?: boolean;
  @IsOptional() @IsBoolean() mayHost?: boolean;
  @IsOptional() @IsBoolean() commercialUseAllowed?: boolean;
  @IsOptional() @IsString() checksum?: string;
  @IsOptional() @IsObject() metadata?: Record<string, unknown>;
}

export class UpdateContentSourceDto {
  @IsOptional() @IsString() @MinLength(1) kind?: string;
  @IsOptional() @IsString() @MinLength(1) title?: string;
  @IsOptional() @IsString() @MinLength(1) publisher?: string;
  @IsOptional() @IsString() creator?: string;
  @IsOptional() @IsUrl({ require_tld: false }) canonicalUrl?: string;
  @IsOptional() @IsUrl({ require_tld: false }) deepUrl?: string;
  @IsOptional() @IsString() sourceTier?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) authorityScopes?: string[];
  @IsOptional() @IsString() sourceStatus?: string;
  @IsOptional() @IsDateString() publishedAt?: string;
  @IsOptional() @IsDateString() issuedAt?: string;
  @IsOptional() @IsDateString() checkedAt?: string;
  @IsOptional() @IsString() rightsHolder?: string;
  @IsOptional() @IsString() rightsBasis?: string;
  @IsOptional() @IsString() licenseName?: string;
  @IsOptional() @IsUrl({ require_tld: false }) licenseUrl?: string;
  @IsOptional() @IsString() attributionText?: string;
  @IsOptional() @IsBoolean() mayLink?: boolean;
  @IsOptional() @IsBoolean() mayEmbed?: boolean;
  @IsOptional() @IsBoolean() mayQuote?: boolean;
  @IsOptional() @IsBoolean() mayReproduce?: boolean;
  @IsOptional() @IsBoolean() mayAdapt?: boolean;
  @IsOptional() @IsBoolean() mayTranslate?: boolean;
  @IsOptional() @IsBoolean() mayHost?: boolean;
  @IsOptional() @IsBoolean() commercialUseAllowed?: boolean;
  @IsOptional() @IsString() checksum?: string;
  @IsOptional() @IsObject() metadata?: Record<string, unknown>;
}

export class CreateContributorDto {
  @IsOptional() @IsUUID() userId?: string;
  @IsOptional() @IsEnum(ContributorKind) kind?: ContributorKind;
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/) slug!: string;
  @IsString() @MinLength(1) displayName!: string;
  @IsOptional() @IsString() roleTitle?: string;
  @IsOptional() @IsString() shortBio?: string;
  @IsOptional() @IsArray() bioBlocks?: unknown[];
  @IsOptional() @IsUrl({ require_tld: false }) avatarUrl?: string;
  @IsOptional() @IsUrl({ require_tld: false }) thesisUrl?: string;
  @IsOptional() @IsArray() @IsUrl({ require_tld: false }, { each: true }) sameAs?: string[];
  @IsOptional() @IsBoolean() isPublished?: boolean;
}

export class UpdateContributorDto {
  @IsOptional() @IsUUID() userId?: string;
  @IsOptional() @IsEnum(ContributorKind) kind?: ContributorKind;
  @IsOptional() @IsString() @MinLength(1) displayName?: string;
  @IsOptional() @IsString() roleTitle?: string;
  @IsOptional() @IsString() shortBio?: string;
  @IsOptional() @IsArray() bioBlocks?: unknown[];
  @IsOptional() @IsUrl({ require_tld: false }) avatarUrl?: string;
  @IsOptional() @IsUrl({ require_tld: false }) thesisUrl?: string;
  @IsOptional() @IsArray() @IsUrl({ require_tld: false }, { each: true }) sameAs?: string[];
  @IsOptional() @IsBoolean() isPublished?: boolean;
}

export class CreateResourceDto {
  @IsOptional() @IsString() externalId?: string;
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/) slug!: string;
  @IsString() @MinLength(1) title!: string;
  @IsString() @MinLength(1) summary!: string;
  @IsOptional() @IsString() description?: string;
  @IsEnum(ResourceKind) kind!: ResourceKind;
  @IsEnum(AccessMode) accessMode!: AccessMode;
  @IsEnum(ResourceHostingMode) hostingMode!: ResourceHostingMode;
  @IsOptional() @IsArray() contentBlocks?: unknown[];
  @IsOptional() @IsUrl({ require_tld: false }) externalUrl?: string | null;
  @IsOptional() @IsUUID() sourceArtifactId?: string | null;
  @IsOptional() @IsArray() @IsEnum(Degree, { each: true }) taxonomyDegrees?: Degree[];
  @IsOptional() @IsArray() @IsString({ each: true }) taxonomyFields?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) subjectCodes?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) topicCodes?: string[];
  @IsOptional() @IsUUID() authorProfileId?: string | null;
  @IsArray() @ValidateNested({ each: true }) @Type(() => SourceLinkDto) sources!: SourceLinkDto[];
  @IsOptional() @IsObject() metadata?: Record<string, unknown>;
}

export class UpdateResourceDto {
  @IsOptional() @IsString() @MinLength(1) title?: string;
  @IsOptional() @IsString() @MinLength(1) summary?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsEnum(ResourceKind) kind?: ResourceKind;
  @IsOptional() @IsEnum(AccessMode) accessMode?: AccessMode;
  @IsOptional() @IsEnum(ResourceHostingMode) hostingMode?: ResourceHostingMode;
  @IsOptional() @IsArray() contentBlocks?: unknown[];
  // Omission preserves the current value; explicit null clears it during a
  // hosting-mode transition.
  @IsOptional() @IsUrl({ require_tld: false }) externalUrl?: string | null;
  @IsOptional() @IsUUID() sourceArtifactId?: string | null;
  @IsOptional() @IsArray() @IsEnum(Degree, { each: true }) taxonomyDegrees?: Degree[];
  @IsOptional() @IsArray() @IsString({ each: true }) taxonomyFields?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) subjectCodes?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) topicCodes?: string[];
  // Explicit null removes an existing public attribution; omission preserves it.
  @IsOptional() @IsUUID() authorProfileId?: string | null;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => SourceLinkDto) sources?: SourceLinkDto[];
  @IsOptional() @IsObject() metadata?: Record<string, unknown>;
}

export class RejectEditorialDto {
  @IsString()
  @MinLength(1)
  reason!: string;
}
