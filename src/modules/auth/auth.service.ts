import { BadRequestException, Body, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { SigninDto } from "./dtos/signin.dto";
import { RegisterUserDto } from "./dtos/register-user.dto";
import { UserService } from "../user/user.service";
import { EncoderProvider } from "src/common/providres/encoder.provider";
import { SMTPProvider } from "src/common/providres/smtp.provider";
import { OtpFor, OtpStatus } from "generated/prisma/browser";
import { PrismaService } from "../prisma/prisma.service";
import emailVerificationTemplate from "src/common/templates/emailVerification.template";
import { JwtService } from "@nestjs/jwt";
import { User } from "generated/prisma";



@Injectable()
export class AuthService {

    constructor (private readonly userService:UserService,
         private readonly encoder:EncoderProvider,
          private readonly mailProvider:SMTPProvider,
          private readonly prismaService:PrismaService,
          private readonly jwtService:JwtService
        ){}


    async signin ( signInDto:SigninDto){
        
        const user = await this.userService.findUserByEmail(signInDto.email)

        if(!user){
            throw new NotFoundException("No account is associated with this email address. Please sign up first.")
        }
        

        if(! (await this.comparePassword(signInDto.password, user.password))){

            throw new BadRequestException("credentials does not matched!")
        }

        if(!user.email_verified){
            this.sendEmailVerificationCode(user.fullName, user.email)
            return {email_verified:false, message:"A verification code sent to your email. Kindly verify your email first."}
        }

        const token = await this.signJwtToken(user)

        return {...user, token}

    }

    private async signJwtToken(user:User){  
        const token = await this.jwtService.signAsync({id:user.id, role:user.role, email:user.email, email_verified:user.email_verified})

        return token
    }



     async registerUser (@Body() registerUserDto:RegisterUserDto) {
        
        const existingUser = await this.userService.findUserByEmail(registerUserDto.email)
        if(existingUser){
            throw new ConflictException('This eamil already registered, kindly sign in to your account!')
        }
        const user =  await this.userService.addUser(registerUserDto)
        //Send verification code to user email
        this.sendEmailVerificationCode(user.fullName, user.email)

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

        return {message:"email verified. Please log in to your account"}
    }

    async resendEmailVerificationCode(email:string){
        const user = await this.userService.findUserByEmail(email)

        if(!user){
            throw new NotFoundException("user not found")
        }
        await this.sendEmailVerificationCode(user.fullName,user.email)

        return {message:"email verification code resent successfully"}
    }


    private async comparePassword(password:string, hash:string):Promise<boolean>{

        return await this.encoder.compare(password, hash)
    }


    private generateEmailVerificationCode(){

        return Math.round(Math.random() * 900000)
    }


    private async sendEmailVerificationCode(name:string, email:string){

        const code = this.generateEmailVerificationCode()
        const expirationTime = new Date(Date.now() + 5 * 60 * 1000)

        await this.prismaService.otp.create({data:{code, for:OtpFor.Email_Verification, email, expires_in:expirationTime}})

        const emailTemplate = emailVerificationTemplate({name,verificationCode:code, verificationCodeExpire:5})

        this.mailProvider.sendMail(email, "Email Verification code", emailTemplate)
    }


    async deleteAccount(email:string, password:string){

        const user  = await this.userService.findUserByEmail(email)

        if(!user){
            throw new NotFoundException("user not found")
        }

        if(!this.comparePassword(password, user.password)){
            throw new BadRequestException("passowrd does not matched")
        }
        const deletedUser = await this.userService.deleteUserById(user.id)

        return deletedUser
    }

    async getAuthenticatedUser(userId:string){

        const userDetails = await this.userService.findUserById(userId)

        return userDetails
        
    }


   
}