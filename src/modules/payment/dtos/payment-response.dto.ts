import { Expose, Type } from "class-transformer";
import { ValidateNested } from "class-validator";
import { PaginationResponseDto } from "src/common/dtos/pagination-response.dto";

export class PaymentResponse{
    @Expose({
        name:"createdAt"
    })
    paymentDate:string

    @Expose()
    player_name:string

    @Expose()
    session_title:string

    @Expose()
    amount:number

}

export class PaymentResponseDto extends PaginationResponseDto {

    @Expose()
    @ValidateNested()
    @Type(() => PaymentResponse)
    payments:PaymentResponse[]
    

}