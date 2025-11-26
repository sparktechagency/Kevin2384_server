import { IsNotEmpty, IsOptional, IsString } from "class-validator"

export class UpdateUserDto{
    @IsString()
    @IsNotEmpty()
    @IsOptional()
    fullName:string
    
    @IsString()
    @IsNotEmpty()
    @IsOptional()
    phone:string
}