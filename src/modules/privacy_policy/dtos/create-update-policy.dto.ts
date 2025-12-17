import { IsEnum, IsNotEmpty, IsString } from "class-validator";
import { PolicyType } from "generated/prisma/enums";

export class CreateUpdatePolicyDto {

    @IsEnum(PolicyType)
    @IsNotEmpty()
    @IsString()
    type:PolicyType

    @IsString()
    @IsNotEmpty()
    content:string
}