import { Expose, Type } from "class-transformer"
import { ValidateNested } from "class-validator"
import { PaginationResponseDto } from "src/common/dtos/pagination-response.dto"

export class RefundResponse{
    @Expose({
        name:"createdAt"
    })
    requested_at:string

    @Expose()
    player_name:string

    @Expose()
    status:string

    @Expose()
    session_title:string

    @Expose()
    amount:number

    @Expose()
    reason:string

}

export class RefundResponseDto extends PaginationResponseDto {

    @Expose()
    @ValidateNested()
    @Type(() => RefundResponse)
    refunds:RefundResponse[]
    

}