import { IsMongoId, IsNotEmpty, IsString } from "class-validator"

export class WarnCoachDto{

    @IsString()
    @IsNotEmpty()
    note:string

    @IsMongoId()
    @IsNotEmpty()
    @IsString()
    session_id:string

}