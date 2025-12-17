import { Expose, Type } from "class-transformer";
import { ValidateNested } from "class-validator";
import { PaginationResponseDto } from "src/common/dtos/pagination-response.dto";
import { PaymentResponse } from "./payment-response.dto";


export class RefundResponseDto extends PaginationResponseDto {

    @Expose()
    @ValidateNested()
    @Type(() => PaymentResponse)
    refunds:PaymentResponse[]


}