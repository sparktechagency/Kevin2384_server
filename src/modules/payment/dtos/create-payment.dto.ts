import { IsEnum, IsIn, IsNotEmpty, IsNumber, IsString } from "class-validator"
import { PaymentType } from "generated/prisma/enums"

export class CreatePaymentDto{

    @IsString()
    @IsNotEmpty()
    participant_id:string

    @IsString()
    @IsNotEmpty()
    item_id:string


    @IsEnum(PaymentType)
    payment_type:PaymentType

}
