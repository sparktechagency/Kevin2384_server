import { Transform } from "class-transformer"
import { IsDate, IsDateString, IsNotEmpty, IsOptional, IsString } from "class-validator"

export class UpdateUserDto{
    @IsString()
    @IsNotEmpty()
    @IsOptional()
    fullName:string
    
    @IsString()
    @IsNotEmpty()
    @IsOptional()
    phone:string

 
    @IsNotEmpty()
    @IsOptional()
    @IsDate()
    @Transform((obj) => {
        return new Date(obj.value)
    })
    dob:Date
}