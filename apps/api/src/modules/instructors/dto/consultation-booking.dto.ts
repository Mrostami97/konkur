import { ArrayMaxSize, ArrayMinSize, IsArray, IsISO8601, IsOptional, IsString, IsUrl, IsUUID, MaxLength, MinLength } from "class-validator";

export class RequestBookingDto {
  @IsUUID()
  offeringId!: string;

  /** Times the student can make. Capped at three: this is a suggestion for
   * the instructor, not an availability search. */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @IsISO8601({}, { each: true })
  requestedSlots!: string[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  studentNote?: string;
}

export class ConfirmBookingDto {
  @IsISO8601()
  scheduledAt!: string;

  /** Meeting link, or left out for a phone or in-person session described in
   * the note. */
  @IsOptional()
  @IsUrl({ require_protocol: true })
  meetingUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  instructorNote?: string;
}

export class CancelBookingDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

export class CloseBookingDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  instructorNote?: string;
}
