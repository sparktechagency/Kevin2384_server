import { BadRequestException, Body, ConflictException, Injectable, Logger, NotFoundException, Res, UnauthorizedException } from "@nestjs/common";
import { SigninDto } from "./dtos/signin.dto";
import { RegisterUserDto } from "./dtos/register-user.dto";
import { UserService } from "../user/user.service";
import { EncoderProvider } from "src/common/providres/encoder.provider";
import { SMTPProvider } from "src/common/providres/smtp.provider";
import { OtpFor, OtpStatus } from "generated/prisma/browser";
import { PrismaService } from "../prisma/prisma.service";
import emailVerificationTemplate from "src/common/templates/emailVerification.template";
import { JwtService } from "@nestjs/jwt";
import { User } from "generated/prisma/client";




@Injectable()
export class AuthService {
        private readonly logger = new Logger(AuthService.name);

    constructor (private readonly userService:UserService,
         private readonly encoder:EncoderProvider,
          private readonly mailProvider:SMTPProvider,
          private readonly prismaService:PrismaService,
          private readonly jwtService:JwtService
        ){}

        /**
         * 
         * @param signInDto 
         * @returns 
         */

    async signin ( signInDto:SigninDto){
        
        const user = await this.userService.findUserByEmail(signInDto.email)


        if(!user){
            throw new NotFoundException("No account is associated with this email address. Please sign up first.")
        }

        if(user.is_deleted){
            throw new BadRequestException("Sorry! Your account has been deleted.")
        }

        if(user.is_blocked){
            
            throw new BadRequestException("Sorry! Your account has been blocked. Please contact support for more information.")
        }

        
        if(! (await this.comparePassword(signInDto.password, user.password))){

            throw new BadRequestException("credentials does not matched!")
        }

        if(!user.email_verified){
            this.sendEmailVerificationCode(user.fullName, user.email)
            return {email_verified:false, message:"A verification code sent to your email. Kindly verify your email first."}
        }

        await this.userService.updateFcmToken(user.id, signInDto.fcm_token)

        const token = await this.signJwtToken(user)
        this.logger.log(`${user.fullName} logged in.`)

        return {...user, token}

    }
    /**
     * 
     * @param email 
     * @param password 
     * @returns 
     */

    async adminSignIn(signInDto:SigninDto){

        console.log("Admin sign in: ", signInDto)

        const user = await this.userService.findUserByEmail(signInDto.email)
        if(!user){
            throw new NotFoundException("No account is associated with this email address. Please sign up first.")
        }
        console.log(user)

        if(user.role !== 'ADMIN'){
            throw new UnauthorizedException("You are not authorized to access this resource.")
        }
        const passwordMatched = await this.comparePassword(signInDto.password, user.password)

        if(!passwordMatched){
            throw new BadRequestException("credentials does not matched!")
        }

        const token = await this.signJwtToken(user)
        this.logger.log(`Admin ${user.fullName} logged in.`)

        return {...user, token}
    }

    /**
     * 
     * @param user 
     * @returns 
     */

    private async signJwtToken(user:User){  
        const token = await this.jwtService.signAsync(
            {id:user.id, role:user.role, email:user.email, email_verified:user.email_verified}, 
            {
            expiresIn: "90d"})

        return token
    }

    /**
     * 
     * @param registerUserDto 
     * @returns 
     */

     async registerUser (@Body() registerUserDto:RegisterUserDto) {
        
        const existingUser = await this.userService.findUserByEmail(registerUserDto.email)

        if(existingUser){
            throw new ConflictException('This eamil already registered, kindly sign in to your account!')
        }

        if(registerUserDto.password !== registerUserDto.confirmPassword){
            throw new BadRequestException("password and confirm password does not matched")
        }

        const {confirmPassword, ...userData} = registerUserDto
        const user =  await this.userService.addUser(userData)
        //Send verification code to user email
        this.sendEmailVerificationCode(user.fullName, user.email)

        return `A verification mail sent to ${user.email}`
    }

    /**
     * 
     * @param email 
     * @param code 
     * @returns 
     */

    async verifyEamil(email:string, code:number){
        const existingCode = await this.prismaService.otp.findFirst({where:{code, email, otp_status:OtpStatus.CREATED}})

        if(!existingCode){
            throw new NotFoundException("otp is invalid or incorrect!")
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

    /**
     * 
     * @param email 
     * @returns 
     */
    async resendEmailVerificationCode(email:string){
        const user = await this.userService.findUserByEmail(email)

        if(!user){
            throw new NotFoundException("user not found")
        }
        await this.sendEmailVerificationCode(user.fullName,user.email)

        return {message:"email verification code resent successfully"}
    }

    /**
     * 
     * @param password 
     * @param hash 
     * @returns 
     */

    private async comparePassword(password:string, hash:string):Promise<boolean>{
        const res = await this.encoder.compare(password, hash)
        return res
    }

    /**
     * 
     * @returns 
     */

    private generateEmailVerificationCode(){

        return Math.round(100000 + Math.random() * 900000)
    }

    /**
     * 
     * @param name 
     * @param email 
     */

    private async sendEmailVerificationCode(name:string, email:string){

        const code = this.generateEmailVerificationCode()
        const expirationTime = new Date(Date.now() + 10 * 60 * 1000)

        await this.prismaService.otp.create({data:{code, for:OtpFor.Email_Verification, email, expires_in:expirationTime}})

        const emailTemplate = emailVerificationTemplate({name,verificationCode:code, verificationCodeExpire:10})

        this.mailProvider.sendMail(email, "Email Verification code", emailTemplate)
    }

    /**
     * 
     * @param email 
     * @param password 
     * @returns 
     */

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

    /**
     * 
     * @param userId 
     * @returns 
     */

    async getAuthenticatedUser(userId:string){

        const userDetails = await this.userService.findUserById(userId)

        return userDetails
        
    }


   
}