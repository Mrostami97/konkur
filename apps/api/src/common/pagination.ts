import { Type } from "class-transformer";
import { IsInt, IsOptional, Max, Min } from "class-validator";

/**
 * `?page=&pageSize=` for list endpoints whose rows grow with the business
 * (users, orders, payments, leads). Before this they returned every row on
 * every request -- fine on launch day, a multi-megabyte admin page a year in.
 */
export class PageQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export function pageArgs(query: { page?: number; pageSize?: number }, defaultPageSize = 25) {
  const page = query.page && query.page > 0 ? Math.floor(query.page) : 1;
  const pageSize = query.pageSize && query.pageSize > 0 ? Math.min(100, Math.floor(query.pageSize)) : defaultPageSize;
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}
