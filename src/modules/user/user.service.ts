import { BadRequestException, ConflictException, Injectable, InternalServerErrorException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateUserDto } from "./dtos/create-user.dto";
import { EncoderProvider } from "src/common/providres/encoder.provider";
import { UserQueryDto } from "./dtos/user-query.dto";
import { PaginationDto } from "src/common/dtos/pagination.dto";
import { OtpFor, OtpStatus, SessionStatus, UserRole } from "generated/prisma/enums";
import { ChangePasswordDto } from "./dtos/change-password.dto";
import { DeleteAccountDto } from "./dtos/delete-account.dto";
import { ChangeEmailDto } from "./dtos/change-email.dto";
import { SMTPProvider } from "src/common/providres/smtp.provider";
import { OtpGenerator } from "src/common/providres/OtpGenerator.provider";
import emailVerificationTemplate from "src/common/templates/emailVerification.template";
import { VerifyOtpDto } from "./dtos/verify-otp.dto";
import { OtpData } from "../../common/types/otp-data.type";
import { UpdateUserDto } from "./dtos/update-user.dto";
import { User } from "generated/prisma/client";
import { ForgetPasswordDto } from "./dtos/forget-password.dto";
import { CheckOtpValidation } from "src/common/providres/CheckOtpValidation.provider";
import { ResetPasswordDto } from "./dtos/reset-password.dto";
import { defaultConfig } from "./constants/default_image";


@Injectable()
export class UserService {

    constructor(
        private readonly prismaService: PrismaService,
        private readonly encoder: EncoderProvider,
        private readonly smtpProvider: SMTPProvider,
        private readonly otpGenerator: OtpGenerator
    ) { }

    /**
     * 
     * @param createUserDto 
     * @returns 
     */
    async addUser(createUserDto: CreateUserDto) {
        let avatar: string | undefined
        let sport: string | undefined

        if (createUserDto.role === UserRole.PLAYER) {
            avatar = defaultConfig.DEFAULT_PLAYER_IMAGE
        } else {
            avatar = defaultConfig.DEFAULT_COACH_IMAGE
            sport = createUserDto.sport
        }

        const hashedPassword = await this.encoder.hashPassword(createUserDto.password, 10)
        const user = await this.prismaService.user.create({ data: { ...createUserDto, password: hashedPassword, avatar, sport } })

        return user
    }

    /**
     * 
     * @param userId 
     * @param updateUserDto 
     * @returns 
     */

    async updateUser(userId: string, updateUserDto: UpdateUserDto, file?: Express.Multer.File) {

        const user = await this.prismaService.user.findUnique({ where: { id: userId } })

        if (!user) {
            throw new NotFoundException("user not found")
        }

        const updatedData: Partial<User> = {
            fullName: updateUserDto.fullName ?? user.fullName,
            phone: updateUserDto.phone ?? user.phone,
            dob: updateUserDto.dob ?? user.dob,
            avatar: (file && file.path) ?? user.avatar

        }

        const updatedUser = await this.prismaService.user.update({ where: { id: user.id }, data: updatedData })

        return updatedUser
    }
    /**
     * 
     * @param userId 
     * @param file 
     */

    async updateUserAvatar(userId: string, file: Express.Multer.File) {

        if (!file) {
            throw new BadRequestException("file is required")
        }

        const user = await this.prismaService.user.findUnique({ where: { id: userId } })

        if (!user) {
            throw new NotFoundException("User not found")
        }
        await this.prismaService.user.update({ where: { id: user.id }, data: { avatar: file.path } })
    }

    /**
     * 
     * @param email 
     * @returns 
     */

    async findUserByEmail(email: string) {
        const user = await this.prismaService.user.findUnique({ where: { email } })

        return user
    }

    /**
     * 
     * @param userId 
     * @returns 
     */

    async findUserById(userId: string) {
        const user = await this.prismaService.user.findUnique({ where: { id: userId } })

        return user
    }

    /**
     * 
     * @param userId 
     * @returns 
     */
    async getUnverifiedUsers(pagination: PaginationDto) {

        const skip = (pagination.page - 1) * pagination.limit

        const unverifiedUsers = await this.prismaService.user.findMany({ where: { email_verified: false }, skip, take: pagination.limit })

        return unverifiedUsers
    }

    /**
     * 
     * @param query 
     * @returns 
     */

    async getUsers(query: UserQueryDto) {

        const skip = (query.page - 1) * query.limit

        const queryBuilder = this.getQueryBuilder(query)


        const [users, total] = await this.prismaService.$transaction([
            this.prismaService.user.findMany({ where: { ...queryBuilder }, skip, take: query.limit, include: { subscriptions: { orderBy: { createdAt: "desc" }, take: 1 }, _count: { select: { created_sessions: true } } } }),
            this.prismaService.user.count({ where: { ...queryBuilder } })
        ])


        const mappedUsers = users.map(async user => {
            const { subscriptions, _count, ...rest } = user
            const isSubscriptionActive = subscriptions.some(sub => sub.status === "ACTIVE")
            const current_subscription_end_at = isSubscriptionActive ? subscriptions[0].current_period_end : null
            const total_created_sessions = _count.created_sessions
            const total_canceled_sessions = await this.prismaService.session.count({ where: { coach_id: user.id, status: SessionStatus.CANCELLED } })

            return { ...rest, is_subscription_active: isSubscriptionActive, current_subscription_end_at, total_created_sessions, total_canceled_sessions }
        })

        return { users: mappedUsers, page: query.page, limit: query.limit, total, pages: Math.ceil(total / query.limit) }

    }

    /**
     * 
     * @param query 
     * @returns 
     */

    private getQueryBuilder(query: UserQueryDto) {

        let queryObj: Record<string, any> = {}

        if (query.query) {
            queryObj.fullName = { contains: query.query, mode: "insensitive" }
        }

        if (Object.keys(query).includes("email_verified")) {

            queryObj.email_verified = Boolean(query.email_verified)
        }

        if (query.email) {
            queryObj.email = query.email.trim().toLowerCase()
        }

        if (query.role) {
            queryObj.role = query.role
        }

        return queryObj
    }


    /**
     * 
     * @param email 
     */
    async updateEmailVerificationStatus(email: string) {
        const user = await this.findUserByEmail(email)

        if (!user) {
            throw new NotFoundException("user not found")
        }

        await this.prismaService.user.update({ where: { id: user.id }, data: { email_verified: true } })
    }


    /**
     * 
     * @param userId 
     * @returns 
     */

    async deleteUserById(userId: string) {

        const user = await this.prismaService.user.findUnique({ where: { id: userId }, include: { created_sessions: { where: { status: { in: [SessionStatus.CREATED, SessionStatus.ONGOING] } } } } })

        if (!user) {
            throw new NotFoundException("user not found")
        }

        if (user.role === UserRole.COACH) {
            if (user.created_sessions.length > 0) {

            }
        }

        const updatedUser = await this.prismaService.user.update({ where: { id: user.id }, data: { is_deleted: true } })

        return updatedUser

    }

    /**
     * 
     * @param userId 
     * @returns 
     */

    async isCoach(userId: string) {

        const user = await this.prismaService.user.findFirst({ where: { id: userId } })

        return user && user.role === UserRole.COACH
    }
    /**
     * 
     * @param forgetPasswordDto 
     * @returns 
     */

    async initiateResetPasswordRequest(forgetPasswordDto: ForgetPasswordDto) {
        const user = await this.prismaService.user.findUnique({ where: { email: forgetPasswordDto.email } })

        if (!user) {
            throw new NotFoundException("No Account found Associated with this email")
        }

        await this.sendOtpVerificationEmail(user.fullName, user.email, OtpFor.Forget_Password, 10)

        return "A verification email sent to your email."

    }

    /**
     * 
     * @param verifyOtpDto 
     */

    async verifyResetPasswordRequest(verifyOtpDto: VerifyOtpDto) {
        const otp = await this.prismaService.otp.findFirst({ where: { email: verifyOtpDto.email, otp_status: OtpStatus.CREATED, code: verifyOtpDto.otp } })

        if (!otp || !CheckOtpValidation.check(verifyOtpDto.otp, otp)) {

            throw new BadRequestException("otp invalid or expired")
        }

        if (otp.expires_in < new Date(Date.now())) {
            await this.prismaService.otp.update({ where: { id: otp?.id }, data: { otp_status: OtpStatus.INVALID } })
            throw new BadRequestException("otp expired!Please try again")
        }

        const updatedOtp = await this.prismaService.otp.update({ where: { id: otp.id }, data: { otp_status: OtpStatus.VERIFIED } })

        return { token: updatedOtp.id }
    }

    /**
     * 
     * @param resetPasswordDto 
     */
    async resetPassword(resetPasswordDto: ResetPasswordDto) {
        try {
            const otp = await this.prismaService.otp.findUnique({ where: { id: resetPasswordDto.token, otp_status: OtpStatus.VERIFIED } })

            if (!otp) {
                throw new BadRequestException("reset password token is invalid")
            }

            if (resetPasswordDto.newPassword !== resetPasswordDto.confirmPassword) {
                throw new BadRequestException("password doest not matched")
            }

            const user = await this.prismaService.user.findFirst({ where: { email: otp.email } })

            if (!user) {
                throw new NotFoundException("User not found")
            }

            await this.prismaService.otp.update({ where: { id: otp.id }, data: { otp_status: OtpStatus.INVALID } })

            return await this.updatePassword(user.id, resetPasswordDto.newPassword)
        } catch (err) {
            console.log(err)
            throw new InternalServerErrorException("Reset passsword failed")
        }

    }
    /**
     * 
     * @param userId 
     * @param changePasswordDto 
     * @returns 
     */

    async changePassword(userId: string, changePasswordDto: ChangePasswordDto) {

        const user = await this.prismaService.user.findUnique({ where: { id: userId } })

        if (!user) {
            throw new NotFoundException("User not found")
        }
        if (changePasswordDto.newPassword !== changePasswordDto.confirmPassword) {
            throw new BadRequestException("New password and confirm password does not match")
        }


        const passwordMathced = await this.encoder.compare(changePasswordDto.currentPassword, user.password)

        if (!passwordMathced) {
            throw new BadRequestException("Incorrect Current Password")
        }

        const samePasswordCheck = await this.encoder.compare(changePasswordDto.newPassword, user.password)

        if (samePasswordCheck) {
            throw new BadRequestException("You recently used this password")
        }

        const updatedUser = await this.updatePassword(user.id, changePasswordDto.newPassword)

        return updatedUser

    }

    private async updatePassword(userId: string, newPassword: string) {

        const hashedPsssword = await this.encoder.hashPassword(newPassword, 10)

        const updatedUser = await this.prismaService.user.update({ where: { id: userId }, data: { password: hashedPsssword } })

        return updatedUser
    }

    /**
     * 
     * @param userId 
     * @param deleteAccountDto 
     */
    async deleteAccount(userId: string, deleteAccountDto: DeleteAccountDto) {
        const user = await this.prismaService.user.findUnique({ where: { id: userId } })

        if (!user) {
            throw new NotFoundException("user not found")
        }
        if (!(await this.isPasswordMatched(deleteAccountDto.password, user.password))) {
            throw new BadRequestException("Password is incorrect")
        }

        const createdSessions = await this.prismaService.session.findMany({ where: { coach_id: userId } })

        if (createdSessions.length > 0) {
            throw new BadRequestException("You have created sessions. You can not delete account")
        }

        await this.prismaService.user.delete({ where: { id: user.id, is_deleted: true } })

    }
    /**
     * 
     * @param password 
     * @param hash 
     * @returns 
     */
    async isPasswordMatched(password: string, hash: string) {

        return await this.encoder.compare(password, hash)
    }
    /**
     * 
     * @param userId 
     * @param changeEmailDto 
     */
    async changeEmailInitiate(userId: string, changeEmailDto: ChangeEmailDto) {

        const user = await this.prismaService.user.findUnique({ where: { id: userId } })

        if (!user) {
            throw new NotFoundException("user exist with this email. Try with another email.")
        }

        const isUserAlreadyExist = await this.findUserByEmail(changeEmailDto.email)

        if (isUserAlreadyExist) {
            throw new ConflictException("user exist with this email. Try with another email.")
        }

        const data = {
            newEmail: changeEmailDto.email
        }


        this.sendOtpVerificationEmail(user.fullName, changeEmailDto.email, OtpFor.Change_Email, 15, data)

    }

    /**
     * 
     * @param userId 
     * @param verifyOtpDto 
     * @returns 
     */

    async verifyOtp(verifyOtpDto: VerifyOtpDto) {
        const user = await this.prismaService.user.findFirst({ where: { email: verifyOtpDto.email } })

        if (!user) {
            throw new NotFoundException("User not found")
        }

        const otp = await this.prismaService.otp.findFirst({ where: { email: verifyOtpDto.email, code: verifyOtpDto.otp, otp_status: OtpStatus.CREATED } })

        if (!otp || !CheckOtpValidation.check(verifyOtpDto.otp, otp)) {

            throw new BadRequestException("otp invalid or expired")
        }

        if (otp.expires_in < new Date(Date.now())) {
            await this.prismaService.otp.update({ where: { id: otp?.id }, data: { otp_status: OtpStatus.INVALID } })
            throw new BadRequestException("otp expired!Please try again")
        }

        // get the new email from otp data
        const otpData = otp.data as OtpData

        if (otp.for === OtpFor.Change_Email) {

            await this.prismaService.otp.update({ where: { id: otp.id }, data: { otp_status: OtpStatus.INVALID } })

            await this.setNewEmail(user.id, otpData.newEmail)
        }

    }

    /**
     * 
     * @param userId 
     * @param newEmail 
     */

    private async setNewEmail(userId: string, newEmail: string) {

        await this.prismaService.user.update({ where: { id: userId }, data: { email: newEmail } })
    }

    /**
     * 
     * @param userId 
     */

    async toggleUserBlockStatus(userId: string) {

        const user = await this.prismaService.user.findUnique({ where: { id: userId } })

        if (!user) {
            throw new NotFoundException("User not found")
        }
        if (user.is_blocked) {
            await this.unblockUser(userId)
        } else {
            await this.blockUser(userId)
        }
    }

    /**
     * 
     * @param userId 
     */

    async blockUser(userId: string) {

        const user = await this.prismaService.user.findUnique({ where: { id: userId } })
        if (!user) {
            throw new NotFoundException("User not found")
        }
        await this.prismaService.user.update({ where: { id: user.id }, data: { is_blocked: true } })
    }

    /**
     * 
     * @param userId 
     */
    async unblockUser(userId: string) {

        const user = await this.prismaService.user.findUnique({ where: { id: userId } })
        if (!user) {
            throw new NotFoundException("User not found")
        }
        await this.prismaService.user.update({ where: { id: user.id }, data: { is_blocked: false } })
    }

    /**
     * 
     * @param name 
     * @param email 
     * @param otpFor 
     * @param expirayTimeInMinute 
     * @param data 
     */
    private async sendOtpVerificationEmail(name: string, email: string, otpFor: OtpFor, expirayTimeInMinute?: number, data?: OtpData) {

        const code = this.otpGenerator.generate()

        const otpExpiryMinute = expirayTimeInMinute ?? 5

        const expirationTime = new Date(Date.now() + otpExpiryMinute * 60 * 1000)

        await this.prismaService.otp.create({ data: { code, for: otpFor, email, expires_in: expirationTime, data } })

        const emailTemplate = emailVerificationTemplate({ name, verificationCode: code, verificationCodeExpire: otpExpiryMinute })

        this.smtpProvider.sendMail(email, "Verification code for change email", emailTemplate)
    }

    /**
     * 
     * @param userId 
     * @param reason 
     */
    async warnUser(adminId: string, userId: string, reason: string) {
        const adminUser = await this.prismaService.user.findUnique({ where: { id: adminId } })

        if (!adminUser || adminUser.role !== UserRole.ADMIN) {
            throw new NotFoundException("Admin user not found")
        }
        const user = await this.prismaService.user.findUnique({ where: { id: userId } })

        if (!user) {
            throw new NotFoundException("User not found")
        }

        console.log(`User ${user.fullName} has been warned by Admin ${adminUser.fullName} for reason: ${reason}`)

    }

    async getPlayerGrowth(year: number) {

        const start = new Date(year, 0, 1)
        const end = new Date(year, 11, 30)
        const players = await this.prismaService.user.findMany({ where: { role: UserRole.PLAYER, createdAt: { gte: start, lte: end } } })

        const monthsData = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, total: 0 }))

        players.forEach(player => {
            let createdMonth = new Date(player.createdAt).getMonth()

            monthsData[createdMonth].total += 1
        })

        return monthsData
    }

    async getUserGrowth(year: number) {

        const start = new Date(year, 0, 1)
        const end = new Date(year, 11, 30)
        const users = await this.prismaService.user.findMany({ where: { role: { not: UserRole.ADMIN }, createdAt: { gte: start, lte: end } } })

        const monthsData = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, total: 0 }))

        users.forEach(player => {
            let createdMonth = new Date(player.createdAt).getMonth()

            monthsData[createdMonth].total += 1
        })

        return monthsData
    }

    async getAllCoaches(paginationDto: PaginationDto) {

        const skip = (paginationDto.page - 1) * paginationDto.limit

        const coaches = await this.prismaService.user.findMany({
            where: { role: UserRole.COACH },
            orderBy: { createdAt: "desc" },
            skip,
            take: paginationDto.limit
        })

        const count = await this.prismaService.user.count({ where: { role: UserRole.COACH } })

        return { coaches, total: count }

    }

    async updateFcmToken(userId: string, token: string) {
        await this.prismaService.user.update({ where: { id: userId }, data: { fcm_token: token } })
    }

}