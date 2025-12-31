import { IsBoolean, IsMongoId, IsNotEmpty, IsString } from "class-validator"

export class ReportSessioDto {

    @IsMongoId()
    @IsString()
    @IsNotEmpty()
    sessionId:string

    @IsMongoId()
    @IsString()
    @IsNotEmpty()
    participantId:string


    @IsNotEmpty()
    @IsString()
    description:string

    @IsBoolean()
    @IsNotEmpty()
    ask_refund:boolean
    
}