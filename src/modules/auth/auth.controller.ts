import { Body, Controller, Post } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { SigninDto } from "./dtos/signin.dto";
import { RegisterUserDto } from "./dtos/register-user.dto";
import { ResendCodeDto } from "./dtos/resend-code.dto";

@Controller({
    path:"auth/"
})
export class AuthController {

    constructor(private readonly authService:AuthService){}

    @Post("signin")
    async signinUser(@Body() signinDto:SigninDto){
        const user = await this.authService.signin(signinDto)

        return user
    }

    @Post("register")
    async registerUser(@Body() registerDto:RegisterUserDto){
        const message = await this.authService.registerUser(registerDto)

        return {message}
    }

    @Post("resend-code")
    async resendCode(@Body() resednCodeDto:ResendCodeDto){
        const message = await this.authService.resendEmailVerificationCode(resednCodeDto.email)

        return message
    }

}