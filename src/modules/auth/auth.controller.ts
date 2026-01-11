import { Body, Controller, Get, HttpCode, HttpStatus, Logger, Post, Req, Res } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { SigninDto } from "./dtos/signin.dto";
import { RegisterUserDto } from "./dtos/register-user.dto";
import { ResendCodeDto } from "./dtos/resend-code.dto";
import { VerifyEmailDto } from "./dtos/verify-email.dto";
import { ResponseMessage } from "src/common/decorators/apiResponseMessage.decorator";
import { plainToInstance } from "class-transformer";
import { SignInResponseDto } from "./dtos/sign-in-response.dto";
import { Public } from "src/common/decorators/public.decorator";
import { TokenPayload } from "./types/TokenPayload.type";
import { UserResponseDto } from "../user/dtos/user-response.dto";
import type { Response } from "express";

@Controller({
    path:"auth"
})
export class AuthController {



    constructor(private readonly authService:AuthService,){}

    @Post("signin")
    @Public()
    @ResponseMessage("user signed in")
    @HttpCode(HttpStatus.OK)
    async signinUser(@Body() signinDto:SigninDto){
        const user = await this.authService.signin(signinDto)
        
        return plainToInstance(SignInResponseDto,user, {
            excludeExtraneousValues:true
        })
    }

    @Post("admin/signin")
    @Public()
    @HttpCode(HttpStatus.OK)
    @ResponseMessage("admin signed in")
    async adminSignin(@Body() signinDto:SigninDto){
        const user =  await this.authService.adminSignIn(signinDto)

        // response.cookie("token", user.token, {
        //     secure:true,
        //     httpOnly:true,
        //     sameSite:true
        // })


        return plainToInstance(SignInResponseDto,user, {
            excludeExtraneousValues:true
        })
    }

    @Post("register")
    @Public()
    @ResponseMessage("A verification mail sent to your email.")
    async registerUser(@Body() registerDto:RegisterUserDto){

        console.log(registerDto)
        await this.authService.registerUser(registerDto)
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

  
    @Get("me")
    @ResponseMessage("User details fethced successfully")
    async getAuthenticatedUser(@Req() request:Request){
        const tokenpayload = request["payload"] as TokenPayload

        const userDetails = await this.authService.getAuthenticatedUser(tokenpayload.id)

        return plainToInstance(UserResponseDto, userDetails, {
            excludeExtraneousValues: true
        })
    }

}