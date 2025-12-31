import { Expose, Type } from "class-transformer"
import { ValidateNested } from "class-validator"
import { ParticipantPaymentStatus, PaymentMethod } from "generated/prisma/enums"
import { SessionResponseDto } from "./session-response.dto"
import { PaginationResponseDto } from "./pagination-response.dto"




class PlayerResponseDto {
    @Expose()
    id:string

    @Expose()
    avatar:string

    @Expose()
    fullName:string
}

class EnrolledPlayerAndSessionResponseDto {
    @Expose()
    @ValidateNested()
    @Type(() => SessionResponseDto)
    session:SessionResponseDto

    @Expose()
    @ValidateNested()
    @Type(() => PlayerResponseDto)

    player:PlayerResponseDto

    @Expose()
    payment_status:ParticipantPaymentStatus
    
    @Expose()
    payment_method:PaymentMethod
}

export class GetEnrolledPlayerResponseDto  extends PaginationResponseDto{

    @Expose()
    @ValidateNested()
    @Type(() => EnrolledPlayerAndSessionResponseDto)
    players:EnrolledPlayerAndSessionResponseDto
    
  

}