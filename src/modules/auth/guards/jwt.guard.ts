import { BadRequestException, CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Request } from "express";
import { TokenPayload } from "../types/TokenPayload.type";
import { Reflector } from "@nestjs/core";
import { PUBLIC_KEY } from "src/common/decorators/public.decorator";
import { UserService } from "src/modules/user/user.service";

@Injectable()
export class JwtGuard implements CanActivate {

    constructor(private readonly jwtService:JwtService,
        private readonly reflector: Reflector,
        private readonly userService:UserService
    ){}

    async canActivate(context: ExecutionContext):Promise<boolean> {
        const request = context.switchToHttp().getRequest<Request>()

        const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [context.getHandler(), context.getClass()]);

        if(isPublic){
            return true
        }

        try{
            const token = this.extractToken(request)
    
            const payload = await this.jwtService.verifyAsync<TokenPayload>(token, {secret:"MySecret"})

            const user = await this.getUserData(payload.id)
            if(!user || user.is_blocked || user.is_deleted){
                throw new BadRequestException("User data does not exist")
            }

            request['payload'] = payload


            return true
            
        }catch(err){
            throw err
        }

      
    }

    private extractToken(request:Request){

        if(!request.headers.authorization){
            throw new BadRequestException("authorizatin header missing")
        }
        const [type, token] = request.headers.authorization?.split(" ") || []

        if(type !== "Bearer")
            throw new UnauthorizedException("token type is not valid")
        if(!token){
            throw new UnauthorizedException("token is missing")
        }
    
            return token
    }
    private async getUserData(userId:string){
        const user = await this.userService.findUserById(userId)
        return user
    }
    
}