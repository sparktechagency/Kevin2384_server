import { IsMongoId, IsNotEmpty, IsString } from "class-validator"

export class RejectRefundRequestDto {

    @IsMongoId()
    @IsNotEmpty()
    @IsString()
    requestId:string

    @IsNotEmpty()
    @IsString()
    note:string
}