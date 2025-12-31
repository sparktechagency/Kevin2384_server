import { Expose, Type } from "class-transformer"
import { ValidateNested } from "class-validator"
import { PaginationResponseDto } from "src/common/dtos/pagination-response.dto"
import { CoachResponseDto } from "src/modules/session/dtos/coach-response.dto"

export class RefundResponse{

    @Expose()
    id:string
    @Expose({
        name:"createdAt"
    })
    submitted_at:string

    @Expose()
    player_name:string

    @Expose()
    avatar:string

    @Expose()
    status:string

    @Expose()
    session_title:string

    @Expose()
    amount:number

    @Expose()
    reason:string

    @Expose()
    rejection_note:string

    @Expose({
        groups:["admin"]
    })
    @ValidateNested()
    @Type(() => CoachResponseDto)
    coach:CoachResponseDto

}

export class RefundResponseDto extends PaginationResponseDto {

    @Expose()
    @ValidateNested()
    @Type(() => RefundResponse)
    refunds:RefundResponse[]



}