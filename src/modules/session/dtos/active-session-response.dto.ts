import { Expose, Type } from "class-transformer"
import { PaginationResponseDto } from "./pagination-response.dto"
import { SessionResponseDto } from "./session-response.dto"
import { ValidateNested } from "class-validator"

export class ActiveSessionResponseDto extends PaginationResponseDto{
    
    @Expose()
    @Type(() => SessionResponseDto)
    @ValidateNested()
    sessions:SessionResponseDto[]

}