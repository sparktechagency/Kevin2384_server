import { Injectable } from "@nestjs/common";
import { ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, SubscribeMessage, WebSocketGateway, WebSocketServer, WsException } from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { ChatService } from "../chat.service";
import { Events, SUBSCRIBED_EVENTS } from "../enums/events.enum";



@WebSocketGateway()
@Injectable()
export class SocketGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect{

      
    @WebSocketServer()
    server:Server

    usersSocket:Map<string, string>

    constructor (private readonly chatService:ChatService){
        this.usersSocket = new Map<string, string>()
    }
 
    handleDisconnect(client: Socket) {
        console.log(`client disconnected: ${client.id}`)
        
        // Find the userId associated with the disconnected socket ID
        // Note: client.data.userId is the safest way to get the userId here
        const userId = client.data.userId

        if (userId) {
            // Remove the userId and its old client.id from the map
            this.usersSocket.delete(userId)
            console.log(`User ${userId} removed from usersSocket map.`)
        }
    }
  

    async handleConnection(client: Socket, ...args: any[] ) {
        console.log(`client connected: ${client.id}`)
        try{
            const userId = (client.handshake.query.userId as string)
            this.usersSocket.set(userId.toString(), client.id)

            client.data.userId = userId
            
            client.emit(Events.SUCCESS, {message:"Successfully connected"})

        }catch(err){
            client.emit(Events.ERROR, err)
            client.disconnect()
            console.log("Authentication error", err)
           
        }
        // client.join(client.id)
        
    }

    afterInit(server: any) {
        console.log("Websocket server initialized")
    }


    @SubscribeMessage("greeting")
    handleMessage(@MessageBody() data:any, @ConnectedSocket() client:Socket){
        
        
    }

    @SubscribeMessage(SUBSCRIBED_EVENTS.MESSAGE)
    async handleChat(@MessageBody() data:any, @ConnectedSocket() client:Socket){

        const userId = client.data.userId 
        const chat = await this.chatService
    
        const socketRoomId = this.usersSocket.get(data.receiver.toString())
        const sender = this.usersSocket.get(userId.toString())

        if(sender){
            this.server.to(sender).emit(Events.NEW_MESSAGE, chat)
        }

       if(socketRoomId){
        this.server.to(socketRoomId).emit(Events.NEW_MESSAGE, chat)
       }
    }

    @SubscribeMessage(SUBSCRIBED_EVENTS.SEND_FILE)
    async handleFile( receiverId:string, chat:any){
        
    
        const socketRoomId = this.usersSocket.get(receiverId)

       if(socketRoomId){
        this.server.to(socketRoomId).emit(Events.NEW_MESSAGE, chat)
       }
    }


    @SubscribeMessage(SUBSCRIBED_EVENTS.FETCH_ROOMS)
    async getAllUserRooms(@MessageBody() data:any, @ConnectedSocket() client:Socket){
        const userId = client.data.userId

        const rooms = await this.chatService
        const socketRoomId = this.usersSocket.get(userId.toString())
    
        if(socketRoomId){
            this.server.to(socketRoomId).emit(Events.ALL_ROOMS, {
                rooms
            })
        }
    }

    @SubscribeMessage(SUBSCRIBED_EVENTS.FETCH_MESSAGES)
    async getAllRoomMessages(@MessageBody() data:{roomId:string}, @ConnectedSocket() client:Socket){
        const userId = client.data.userId
        console.log(data)
        const messages = await this.chatService

         const socketRoomId = this.usersSocket.get(userId.toString())

        if(socketRoomId){
            this.server.to(socketRoomId).emit(Events.ALL_MESSAGES, {
                messages
            })
        }
    }
 
}