import { IsString, MaxLength, MinLength } from "class-validator";

/** The init data string Telegram gives a mini app (window.Telegram.WebApp.initData). */
export class TelegramInitDataDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4096)
  initData!: string;
}
