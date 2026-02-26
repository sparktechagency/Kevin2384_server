import { Module, OnModuleInit } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { PrismaService } from '../prisma/prisma.service';
import { SocketGateway } from './gateway/chat.gateway';
import { UserService } from '../user/user.service';
import { UserModule } from '../user/user.module';

@Module({
    imports:[UserModule],
    controllers:[ChatController],
    providers:[ChatService, PrismaService, SocketGateway],
    exports:[ChatService]
})
export class ChatModule implements OnModuleInit{

    onModuleInit() {
        
    }
}
