import { Expose, Type } from "class-transformer";
import { PaginationResponseDto } from "./pagination-response.dto";
import { SessionResponseDto } from "./session-response.dto";
import { Validate, ValidateNested } from "class-validator";

export class AdminSessionResponseDto extends PaginationResponseDto {


    @Expose({
        groups:["admin"]
    })
    @ValidateNested()
    @Type(() => SessionResponseDto) 
    sessions:SessionResponseDto[]
}