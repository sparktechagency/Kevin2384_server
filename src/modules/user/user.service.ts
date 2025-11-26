import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateUserDto } from "./dtos/create-user.dto";
import { EncoderProvider } from "src/common/providres/encoder.provider";
import { UserQueryDto } from "./dtos/user-query.dto";
import { PaginationDto } from "src/common/dtos/pagination.dto";
import { OtpFor, OtpStatus, UserRole } from "generated/prisma/enums";
import { ChangePasswordDto } from "./dtos/change-password.dto";
import { DeleteAccountDto } from "./dtos/delete-account.dto";
import { ChangeEmailDto } from "./dtos/change-email.dto";
import { SMTPProvider } from "src/common/providres/smtp.provider";
import { OtpGenerator } from "src/common/providres/OtpGenerator.provider";
import emailVerificationTemplate from "src/common/templates/emailVerification.template";
import { VerifyOtpDto } from "./dtos/verify-otp.dto";
import {  OtpData } from "../../common/types/otp-data.type";
import { UpdateUserDto } from "./dtos/update-user.dto";
import { User } from "generated/prisma/client";
import { ForgetPasswordDto } from "./dtos/forget-password.dto";
import { CheckOtpValidation } from "src/common/providres/CheckOtpValidation.provider";
import { ResetPasswordDto } from "./dtos/reset-password.dto";


@Injectable()
export class UserService{

    constructor(
        private readonly prismaService:PrismaService,
        private readonly encoder:EncoderProvider,
        private readonly smtpProvider:SMTPProvider,
        private readonly otpGenerator:OtpGenerator
    ){}

    /**
     * 
     * @param createUserDto 
     * @returns 
     */
    async addUser(createUserDto:CreateUserDto){

        const hashedPassword = await this.encoder.hashPassword(createUserDto.password, 10)
        const user = await this.prismaService.user.create({data:{...createUserDto, password:hashedPassword}})

        return user
    }

    /**
     * 
     * @param userId 
     * @param updateUserDto 
     * @returns 
     */

    async updateUser(userId:string, updateUserDto:UpdateUserDto, file?:Express.Multer.File){

        const user = await this.prismaService.user.findUnique({where:{id:userId}})

        if(!user){
            throw new NotFoundException("user not found")
        }

        const updatedData:Partial<User> = {
            fullName: updateUserDto.fullName ?? user.fullName,
            phone: updateUserDto.phone ?? user.phone,
            avatar: (file && file.path) ?? user.avatar
            
        }

        const updatedUser = await this.prismaService.user.update({where:{id:user.id},data:updatedData})

        return updatedUser
    }
    /**
     * 
     * @param userId 
     * @param file 
     */

    async updateUserAvatar(userId:string, file:Express.Multer.File){

        if(!file){
            throw new BadRequestException("file is required")
        }
        
        const user = await this.prismaService.user.findUnique({where:{id:userId}})

        if(!user){
            throw new NotFoundException("User not found")
        }
        await this.prismaService.user.update({where:{id:user.id}, data:{avatar:file.path}})
    }

    /**
     * 
     * @param email 
     * @returns 
     */

    async findUserByEmail(email:string){
        const user = await this.prismaService.user.findUnique({where:{email}})

        return user
    }

    /**
     * 
     * @param userId 
     * @returns 
     */

    async findUserById(userId:string){
        const user = await this.prismaService.user.findUnique({where:{id:userId}})

        return user
    }

    /**
     * 
     * @param userId 
     * @returns 
     */
    async getUnverifiedUsers(pagination:PaginationDto){

        const skip = (pagination.page - 1) * pagination.limit

        const unverifiedUsers  = await this.prismaService.user.findMany({where:{email_verified:false}, skip, take:pagination.limit})

        return unverifiedUsers
    }

    /**
     * 
     * @param query 
     * @returns 
     */

    async getUsers (query:UserQueryDto){
        
      const skip = (query.page - 1) * query.limit

      const queryBuilder = this.getQueryBuilder(query)


      const [users, total] = await this.prismaService.$transaction([
        this.prismaService.user.findMany({where:{...queryBuilder}, skip, take:query.limit}),
        this.prismaService.user.count({where:{...queryBuilder}})
      ])


      return {users, page:query.page, limit:query.limit, pages:Math.ceil(total / query.limit)}

    }

    /**
     * 
     * @param query 
     * @returns 
     */

    private getQueryBuilder(query:UserQueryDto){

        let queryObj:Record<string, any> = {}
    
        if(query.fullName){
            queryObj.fullName = {contains:query.fullName, mode:"insensitive"}
        }

        if(Object.keys(query).includes("email_verified")){
           
            queryObj.email_verified = Boolean(query.email_verified)
        }

        if(query.email){
            queryObj.email = query.email.trim().toLowerCase()
        }

        if(query.role){
            queryObj.role = query.role
        }

        return queryObj
    }

    
    /**
     * 
     * @param email 
     */
    async updateEmailVerificationStatus(email:string){
        const user = await this.findUserByEmail(email)

        if(!user){
            throw new NotFoundException("user not found")
        }

        await this.prismaService.user.update({where:{id:user.id}, data:{email_verified:true}})
    }

    
    /**
     * 
     * @param userId 
     * @returns 
     */

    async deleteUserById(userId:string){

        const user = await this.prismaService.user.findUnique({where:{id:userId}})

        if(!user){
            throw new NotFoundException("user not found")
        }

        const updatedUser = await this.prismaService.user.update({where:{id:user.id}, data:{is_deleted:true}})

        return updatedUser

    }

    /**
     * 
     * @param userId 
     * @returns 
     */

    async isCoach(userId:string){

        const user = await this.prismaService.user.findFirst({where:{id:userId}})

        return user && user.role === UserRole.COACH
    }
    /**
     * 
     * @param forgetPasswordDto 
     * @returns 
     */

    async initiateResetPasswordRequest(forgetPasswordDto:ForgetPasswordDto){
        const user = await this.prismaService.user.findUnique({where:{email:forgetPasswordDto.email}})

        if(!user){
            throw new NotFoundException("No Account found Associated with this email")
        }

        await this.sendOtpVerificationEmail(user.fullName, user.email, OtpFor.Forget_Password,10)

        return "A verification email sent to your email."

    }
    /**
     * 
     * @param verifyOtpDto 
     */

    async verifyResetPasswordRequest(verifyOtpDto:VerifyOtpDto){
        const otp = await this.prismaService.otp.findFirst({where:{email:verifyOtpDto.email, otp_status:OtpStatus.CREATED}})

        if(!(otp && CheckOtpValidation.check(verifyOtpDto.otp, otp))){
            throw new BadRequestException("otp invalid or expired")
        }

        const updatedOtp = await this.prismaService.otp.update({where:{id:otp.id}, data:{otp_status:OtpStatus.VERIFIED}})

        return {token:updatedOtp.id}
    }

    /**
     * 
     * @param resetPasswordDto 
     */
    async resetPassword(resetPasswordDto:ResetPasswordDto){
        
        const otp = await this.prismaService.otp.findUnique({where:{id:resetPasswordDto.token, otp_status:OtpStatus.VERIFIED}})

        if(!otp){
            throw new BadRequestException("reset password token is invalid")
        }
        if(resetPasswordDto.newPassword !== resetPasswordDto.confirmPassword){
            throw new BadRequestException("password doest not matched")
        }

        const user = await this.prismaService.user.findFirst({where:{email:otp.email}})

        if(!user){
            throw new NotFoundException("User not found")
        }

        await this.prismaService.otp.update({where:{id:otp.id}, data:{otp_status:OtpStatus.INVALID}})

        return await this.updatePassword(user.id, resetPasswordDto.newPassword)
    }
    /**
     * 
     * @param userId 
     * @param changePasswordDto 
     * @returns 
     */

    async changePassword(userId:string,changePasswordDto:ChangePasswordDto ){

        const user = await this.prismaService.user.findUnique({where:{id:userId}})

        if(!user){
            throw new NotFoundException("User not found")
        }
        if(changePasswordDto.newPassword !== changePasswordDto.confirmPassword){
            throw new BadRequestException("New password and confirm password does not match")
        }

    
        const passwordMathced = await this.encoder.compare(changePasswordDto.currentPassword, user.password)

        if( !passwordMathced){
            throw new BadRequestException("Incorrect Current Password")
        }

        const samePasswordCheck = await this.encoder.compare(changePasswordDto.newPassword, user.password)

        if(samePasswordCheck){
            throw new BadRequestException("You recently used this password")
        }

        const updatedUser = await this.updatePassword(user.id, changePasswordDto.newPassword)

       return updatedUser

    }

    private async updatePassword(userId:string, newPassword:string){

        const hashedPsssword = await this.encoder.hashPassword(newPassword, 10)

        const updatedUser =  await this.prismaService.user.update({where:{id:userId}, data:{password:hashedPsssword}})

        return updatedUser
    }

    /**
     * 
     * @param userId 
     * @param deleteAccountDto 
     */
    async deleteAccount(userId:string, deleteAccountDto:DeleteAccountDto){
        const user = await this.prismaService.user.findUnique({where:{id:userId}})

        if(!user){
            throw new NotFoundException("user not found")
        }
        if(!(await this.isPasswordMatched(deleteAccountDto.password, user.password))){
            throw new BadRequestException("Password is incorrect")
        }

        await this.prismaService.user.delete({where:{id:user.id}})
        
    }
    /**
     * 
     * @param password 
     * @param hash 
     * @returns 
     */
    async isPasswordMatched(password:string, hash:string){

        return await this.encoder.compare(password, hash)
    }
    /**
     * 
     * @param userId 
     * @param changeEmailDto 
     */
    async changeEmailInitiate(userId:string,changeEmailDto:ChangeEmailDto){

        const user = await this.prismaService.user.findUnique({where:{id:userId}})

        if(!user){
            throw new NotFoundException("user exist with this email. Try with another email.")
        }

        const isUserAlreadyExist = await this.findUserByEmail(changeEmailDto.email)

        if(isUserAlreadyExist){
            throw new ConflictException("user exist with this email. Try with another email.")
        }

        const data = {
            newEmail:changeEmailDto.email
        }


        this.sendOtpVerificationEmail(user.fullName, changeEmailDto.email,OtpFor.Change_Email, 15, data)

    }

    /**
     * 
     * @param userId 
     * @param verifyOtpDto 
     * @returns 
     */

    async verifyOtp(verifyOtpDto:VerifyOtpDto){
        const user = await this.prismaService.user.findFirst({where:{email:verifyOtpDto.email}})

        if(!user){
            throw new NotFoundException("User not found")
        }

        const otp = await this.prismaService.otp.findFirst({where:{email:verifyOtpDto.email, otp_status:OtpStatus.CREATED}})

        if(!(otp && CheckOtpValidation.check(verifyOtpDto.otp, otp))){
            throw new BadRequestException("otp invalid or expired")
        }
       
        // get the new email from otp data
        const otpData = otp.data as OtpData
       
        if(otp.for === OtpFor.Change_Email){

            await this.prismaService.otp.update({where:{id:otp.id}, data:{otp_status:OtpStatus.INVALID}})

            await this.setNewEmail(user.id, otpData.newEmail)
        }
        
    }

    /**
     * 
     * @param userId 
     * @param newEmail 
     */

    private async setNewEmail(userId:string, newEmail:string){

        await this.prismaService.user.update({where:{id:userId}, data:{email:newEmail}})
    }

    /**
     * 
     * @param name 
     * @param email 
     * @param otpFor 
     * @param expirayTimeInMinute 
     * @param data 
     */
    private async sendOtpVerificationEmail(name:string, email:string, otpFor:OtpFor, expirayTimeInMinute?:number, data?:OtpData){

        const code = this.otpGenerator.generate()

        const otpExpiryMinute = expirayTimeInMinute ?? 5

        const expirationTime = new Date(Date.now() + otpExpiryMinute * 60 * 1000)

        await this.prismaService.otp.create({data:{code, for:otpFor, email, expires_in:expirationTime, data}})

        const emailTemplate = emailVerificationTemplate({name,verificationCode:code, verificationCodeExpire:otpExpiryMinute})

        this.smtpProvider.sendMail(email, "Verification code for change email", emailTemplate)
    }

}