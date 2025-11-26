import { Transform } from "class-transformer";
import { IsEmail, IsNotEmpty, IsNumber } from "class-validator";

export class VerifyOtpDto{
    @IsNumber()
    @IsNotEmpty()
    @Transform(obj => parseInt(obj.value))
    otp:number

    @IsNotEmpty()
    @IsEmail()
    email:string
}