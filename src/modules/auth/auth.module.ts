import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { UserService } from "../user/user.service";
import { EncoderProvider } from "src/common/providres/encoder.provider";
import { PrismaService } from "../prisma/prisma.service";
import { SMTPProvider } from "src/common/providres/smtp.provider";
import { JwtModule } from "@nestjs/jwt";
import { OtpGenerator } from "src/common/providres/OtpGenerator.provider";


@Module({
    imports:[JwtModule.register({secret:"MySecret"})],
    controllers:[AuthController],
    providers:[AuthService, UserService, EncoderProvider, PrismaService, SMTPProvider, OtpGenerator]
})
export class AuthModule {

}