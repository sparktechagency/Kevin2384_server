import { Module } from '@nestjs/common';
import { SessionController } from './session.controller';
import { SessionService } from './session.service';
import { SessionBuilder } from './providers/SessionBuilder.provider';
import { PrismaService } from '../prisma/prisma.service';
import { CoachCancelStrategy } from './strategies/CoachCancelStrategy';
import { PlayerCancelStrategy } from './strategies/PlayerCancelStrategy';
import { RefundModule } from '../refund/refund.module';

@Module({
    imports:[RefundModule],
    controllers:[SessionController],
    providers:[
        SessionService,
        SessionBuilder,
        PrismaService,
        {
            provide: CoachCancelStrategy.INJECTION_KEY,
            useClass: CoachCancelStrategy
        },
        {
            provide: PlayerCancelStrategy.INJECTION_KEY,
            useClass: PlayerCancelStrategy
        }
    ]
})


export class SessionModule {}
