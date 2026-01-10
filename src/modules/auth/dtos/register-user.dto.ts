import { IsEmail, IsEnum, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { UserRole } from "generated/prisma/enums";
import { CreateUserDto } from "src/modules/user/dtos/create-user.dto";

export class RegisterUserDto extends CreateUserDto{

        @IsString()
        @IsNotEmpty()
        @MinLength(2)
        @MaxLength(20)
        fullName:string

        @IsString()
        @IsEmail()
        @IsNotEmpty()
        email:string

        @IsString()
        @IsNotEmpty()
        phone:string

        @IsString()
        @IsNotEmpty()
        @MinLength(6)
        password: string

        @IsString()
        @IsNotEmpty()
        @MinLength(6)
        confirmPassword:string

        @IsString()
        @IsNotEmpty()
        @IsOptional()
        sport?:string

        @IsIn([UserRole.COACH, UserRole.PLAYER])
        @IsNotEmpty()
        role:UserRole


        // @IsString()
        // @IsNotEmpty()
        // @MinLength(8)
        // readonly confirmPassword:string
}