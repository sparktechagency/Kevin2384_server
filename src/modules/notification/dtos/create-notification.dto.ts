import { IsEnum, IsMongoId, IsNotEmpty, IsOptional, IsString } from "class-validator"
import { Audience, NotificationLevel } from "generated/prisma/enums"

export class CreateNotificationDto {

    @IsString()
    @IsMongoId()
    @IsNotEmpty()
    userId:string

    @IsString()
    @IsNotEmpty()
    title:string

    @IsString()
    @IsNotEmpty()
    message:string

    @IsString()
    @IsNotEmpty()
    @IsEnum(NotificationLevel)
    level:NotificationLevel

    @IsEnum(Audience)
    @IsNotEmpty()
    audience:Audience

    @IsMongoId()
    @IsOptional()
    @IsNotEmpty()
    @IsString()
    accepted_by?:string

}