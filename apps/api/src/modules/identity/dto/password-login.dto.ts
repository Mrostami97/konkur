import { IsString, Matches, MinLength } from "class-validator";

export class PasswordLoginDto {
  @Matches(/^\+?[0-9]{8,15}$/, { message: "phone must be a valid phone number" })
  phone!: string;

  // The seeded administrator intentionally uses `123`; production accounts
  // should provision a stronger password through the account-management flow.
  @IsString()
  @MinLength(1, { message: "password must not be empty" })
  password!: string;
}
