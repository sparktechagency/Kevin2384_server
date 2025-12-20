import { Injectable } from "@nestjs/common";
import { Audience, NotificationLevel } from "generated/prisma/enums";
import { NotificationService } from "src/modules/notification/notification.service";

@Injectable()
export class SessionNotifier{

    constructor(private readonly notificationService:NotificationService){}

    async sendNotification(userId:string, audience:Audience, level:NotificationLevel, title:string, message:string){
         this.notificationService.createNotification({
                        audience,
                        level,
                        message,
                        title,
                        userId,
                    })
    }
}