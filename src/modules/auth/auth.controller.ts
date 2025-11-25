import { Body, Controller, Post, Req } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { SigninDto } from "./dtos/signin.dto";
import { RegisterUserDto } from "./dtos/register-user.dto";
import { ResendCodeDto } from "./dtos/resend-code.dto";
import { VerifyEmailDto } from "./dtos/verify-email.dto";
import { ResponseMessage } from "src/common/decorators/apiResponseMessage.decorator";
import { plainToInstance } from "class-transformer";
import { SignInResponseDto } from "./dtos/sign-in-response.dto";
import { Public } from "src/common/decorators/public.decorator";

@Controller({
    path:"auth"
})
export class AuthController {

    constructor(private readonly authService:AuthService){}

    @Post("signin")
    @Public()
    @ResponseMessage("user sign in successfully")
    async signinUser(@Body() signinDto:SigninDto){
        const user = await this.authService.signin(signinDto)
        
        return plainToInstance(SignInResponseDto,user, {
            excludeExtraneousValues:true
        })
    }

    @Post("register")
    @Public()
    @ResponseMessage("user register successfully")
    async registerUser(@Body() registerDto:RegisterUserDto){
        const message = await this.authService.registerUser(registerDto)

        return {message}
    }

    @Post("verify-email")
    @Public()
    @ResponseMessage("email verified successfully")
    async verifyEmail(@Body() verifyEmailDto:VerifyEmailDto){

        const message = await this.authService.verifyEamil(verifyEmailDto.email, verifyEmailDto.code)

        return message
    }

    @Post("resend-code")
    @Public()
    @ResponseMessage("code resent successfully")
    async resendCode(@Body() resednCodeDto:ResendCodeDto){
        const message = await this.authService.resendEmailVerificationCode(resednCodeDto.email)

        return message
    }

    async deleteAccount(@Req() request:Request){
        
    }

}