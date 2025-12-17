import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { SendMessageDto } from "./dtos/send-message.dto";
import { GetAllMessagesDto } from "./dtos/get-all-messages.dto";
import { GetUserRoomsDto } from "./dtos/get-user-rooms.dto";
import { MessageType } from "generated/prisma/enums";

@Injectable()
export class ChatService {

    constructor(
        private readonly prismaService:PrismaService,
    ){}

    /**
     * 
     * @param userId 
     * @param sendMessageDto 
     * @returns 
     */

    async createMessage(userId:string, sendMessageDto:SendMessageDto){

        const room = await this.createChatRoomIfNotExists(userId, sendMessageDto.receiver_id)

        if(sendMessageDto.file){
            let fileUnit8Array = new Uint8Array(Buffer.from(sendMessageDto.file as any))

            const createdChat = await this.prismaService.chat.create({
                data:{
                    chatRoom_id:room.id,
                    sender_id:userId,
                    receiver_id:sendMessageDto.receiver_id,
                    message:sendMessageDto.message,
                    file:fileUnit8Array,
                    type:MessageType.FILE
                }
            })

            
            await this.prismaService.chatRoom.update({
                where:{id:room.id},
                data:{
                    updatedAt:new Date()
                }
            })


            return createdChat

        }


    
        const createdChat = await this.prismaService.chat.create({
            data:{
                chatRoom_id:room.id,
                sender_id:userId,
                receiver_id:sendMessageDto.receiver_id,
                message:sendMessageDto.message,
            }
        })


        await this.prismaService.chatRoom.update({
            where:{id:room.id},
            data:{
                updatedAt:new Date()
            }
        })

        return createdChat

    }
    /**
     * 
     * @param userId 
     * @param receiverId 
     * @returns 
     */

    private async createChatRoomIfNotExists(userId:string, receiverId:string){
        const existingRoom = await this.prismaService.chatRoom.findFirst({where:{
            members:{
                every:{
                    user_id:{in:[userId, receiverId]}
                }
            }
        }, include:{members:true}})
        if(existingRoom){
            return existingRoom
        }
        const newRoom = await this.prismaService.chatRoom.create({
            data:{
                members:{
                    create:[
                        {user_id:userId},
                        {user_id:receiverId}
                    ]
                }
            },
        include:{members:true}},)
        return newRoom
    }

    /**
     * 
     * @param userId 
     * @returns 
     */

    async getUserChatRooms(userId:string, getUserRoomsDto:GetUserRoomsDto){

        const skip = (getUserRoomsDto.page - 1) * getUserRoomsDto.limit

        const [rooms, total] = await Promise.all([
            this.prismaService.chatRoom.findMany({
                where:{ 
                    members:{some:{user_id:userId}}
                },
                include:{members:{where:{user_id:{not:userId}}, include:{user:true}}, 
                    chats:{include:{sender:true}, orderBy:{createdAt:"desc"}, take:1}, 
                    _count:{select:{chats:{where:{is_read:false, receiver_id:userId}}}}},
                orderBy:{   
                    updatedAt:"desc"
                },
                skip,
                take:getUserRoomsDto.limit
            }),
            this.prismaService.chatRoom.count({
                where:{members:{some:{user_id:userId}}}
            })
        ])


        const mappedRoom = rooms.map( ({members,_count,chats,...room}) => { 
          
            const mappedMemebers = members.map(member => {
                return member.user
            })
            const is_latest_message_mine = chats[0]?.sender_id === userId
                
            return {members:mappedMemebers,latest_message:{...chats[0], is_mine:is_latest_message_mine}, new:_count.chats, ...room}
        })
        
       
        return {rooms: mappedRoom, total: total}
    }


    async getRoomMessages(userId:string, getAllMessageDto:GetAllMessagesDto){

        const skip = (getAllMessageDto.page - 1) * getAllMessageDto.limit 
        
        const [messages, total] = await Promise.all([
            this.prismaService.chat.findMany({
                where:{chatRoom_id:getAllMessageDto.roomId},
                include:{sender:true, receiver:true},
                skip,
                take:getAllMessageDto.limit,
                orderBy:{createdAt:"asc"}
            }),
            this.prismaService.chat.count({
                where:{chatRoom_id:getAllMessageDto.roomId}
            })
        ])

        await this.prismaService.chat.updateMany({
            where:{chatRoom_id:getAllMessageDto.roomId,receiver_id:userId, is_read:false},
            data:{is_read:true}
        })

        const mappedMessages = messages.map(message => {

            const is_mine = message.sender_id === userId
            return {...message, is_mine}
        })
        return {messages: mappedMessages, total}
    }

    async sendFile(){}

    async acknowledgeMessageDelivery(messageId:string){
        const chat = await this.prismaService.chat.update({
            where:{id:messageId},
            data:{is_delivered:true}
        })

        return chat
    }
}