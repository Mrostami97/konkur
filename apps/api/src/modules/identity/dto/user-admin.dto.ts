import { Role } from "@prisma/client";
import { ArrayUnique, IsArray, IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";

export class CreateUserDto {
  /** Stored as 09xxxxxxxxx, the form people type at the login page. */
  @Matches(/^(\+98|0098|98|0)?9[0-9]{9}$/, { message: "phone must be an Iranian mobile number" })
  phone!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  lastName?: string;

  @IsArray()
  @ArrayUnique()
  @IsEnum(Role, { each: true })
  roles!: Role[];
}

export class SetRolesDto {
  @IsArray()
  @ArrayUnique()
  @IsEnum(Role, { each: true })
  roles!: Role[];
}

export class SetPasswordDto {
  @IsString()
  @MinLength(8, { message: "password must be at least 8 characters" })
  @MaxLength(128)
  password!: string;
}

export class ChangePhoneDto {
  @Matches(/^(\+98|0098|98|0)?9[0-9]{9}$/, { message: "phone must be an Iranian mobile number" })
  phone!: string;
}
