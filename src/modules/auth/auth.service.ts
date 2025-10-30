import { BadRequestException, Body, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { SigninDto } from "./dtos/signin.dto";
import { RegisterUserDto } from "./dtos/register-user.dto";
import { UserService } from "../user/user.service";
import { EncoderProvider } from "src/common/providres/encoder.provider";
import { plainToInstance } from "class-transformer";
import { UserResponseDto } from "../user/dtos/user-response.dto";
import { SMTPProvider } from "src/common/providres/smtp.provider";
import { OtpStatus, User } from "generated/prisma/browser";
import { PrismaService } from "../prisma/prisma.service";
import emailVerificationTemplate from "src/common/templates/emailVerification.template";



@Injectable()
export class AuthService {

    constructor (private readonly userService:UserService,
         private readonly encoder:EncoderProvider,
          private readonly mailProvider:SMTPProvider,
          private readonly prismaService:PrismaService
        ){}


    async signin ( signInDto:SigninDto){
        
        const user = await this.userService.findUserByEmail(signInDto.email)

        if(!user){
            throw new NotFoundException("No account belong to this email. Please create an account first!")
        }

        if(! (await this.comparePassword(signInDto.password, user.password))){

            throw new BadRequestException("credentials are not matched!")
        }

        // if(!user.email_verified){
        //     return {email_verified:false, message:"Your email is unverified! Kindly verify your email."}
        // }

        return this.userToUserDtoMapper(user)

    }

     async registerUser (@Body() registerUserDto:RegisterUserDto) {
        const user =  await this.userService.addOneUser(registerUserDto)
        //Send verification code to user email
        this.sendEmailVerificationCode(user.name, user.email)

        return `A verification mail sent to ${user.email}`
    }

    async verifyEamil(email:string, code:number){
        const existingCode = await this.prismaService.otp.findFirst({where:{code, email, otp_status:OtpStatus.CREATED}})
        if(!existingCode){
            throw new NotFoundException("otp not found!")
        }

        const currentDate = new Date(Date.now())

        if(currentDate > existingCode.expires_in){

            await this.prismaService.otp.update({where:{id:existingCode.id}, data:{otp_status:OtpStatus.INVALID}})

            throw new BadRequestException("otp is expired")
        }

        //make otp invalid after used first time
        await this.prismaService.otp.update({where:{id:existingCode.id}, data:{otp_status:OtpStatus.INVALID}})

        await this.userService.updateEmailVerificationStatus(email)

        return {message:"email verified!"}
    }

    async resendEmailVerificationCode(email:string){
        const user = await this.userService.findUserByEmail(email)

        if(!user){
            throw new NotFoundException("user not found")
        }
        await this.sendEmailVerificationCode(user.name,user.email)

        return {message:"email verification code sent successfully"}
    }



    private async comparePassword(password:string, hash:string):Promise<boolean>{

        return await this.encoder.compare(password, hash)
    }


    //map user nobject to user DTO
    private userToUserDtoMapper(user:User){

        return plainToInstance(UserResponseDto, user, {
            excludeExtraneousValues:true,
        })
    }

    private generateEmailVerificationCode(){

        return Math.round(Math.random() * 900000)
    }


    private async sendEmailVerificationCode(name:string, email:string){

        const code = this.generateEmailVerificationCode()
        const expirationTime = new Date(Date.now() + 5 * 60 * 1000)

        await this.prismaService.otp.create({data:{code, for:"Change_Password", email, expires_in:expirationTime}})

        const emailTemplate = emailVerificationTemplate({name,verificationCode:code, verificationCodeExpire:5})

        this.mailProvider.sendMail(email, "Email Verification code", emailTemplate)
    }

   
}