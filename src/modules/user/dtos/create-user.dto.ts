import { Transform } from "class-transformer"
import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, MinLength } from "class-validator"
import { UserRole } from "generated/prisma/enums"




export class CreateUserDto {

    @IsNotEmpty()
    @IsString()
    @Transform(({value}) => value.trim())
    readonly fullName:string

    @IsNotEmpty()
    @IsString()
    @IsEmail()
    @Transform(({value}) => value.toLowerCase())
    readonly email:string

    @IsString()

    readonly phone:string

    @IsString()
    @IsNotEmpty()
    @MinLength(8)
    
    readonly password:string

    @IsString()
    @IsNotEmpty()
    @IsIn(["COACH", "PLAYER"])
    readonly role:UserRole

    @IsString()
    @IsOptional()
    @IsNotEmpty()
    sport?:string
}