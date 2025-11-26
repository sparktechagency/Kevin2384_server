import { Module } from "@nestjs/common";
import { UserController } from "./user.controller";
import { PrismaService } from "../prisma/prisma.service";
import { UserService } from "./user.service";
import { EncoderProvider } from "src/common/providres/encoder.provider";
import { SMTPProvider } from "src/common/providres/smtp.provider";
import { OtpGenerator } from "src/common/providres/OtpGenerator.provider";

@Module({
    imports:[],
    controllers:[UserController],
    providers:[PrismaService, UserService, EncoderProvider, SMTPProvider, OtpGenerator],
    exports:[UserService]
})

export class UserModule{

}