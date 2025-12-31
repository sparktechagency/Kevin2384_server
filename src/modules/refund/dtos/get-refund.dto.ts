import { IsMongoId, IsNotEmpty, IsString } from "class-validator";

export class GetRefundDto{

    @IsMongoId()
    @IsString()
    @IsNotEmpty()
    sessionId:string
}