import { IsMongoId, IsNotEmpty, IsString } from "class-validator";

export class AcceptRefundRequestDto {

    @IsMongoId()
    @IsString()
    @IsNotEmpty()
    requestId:string

}