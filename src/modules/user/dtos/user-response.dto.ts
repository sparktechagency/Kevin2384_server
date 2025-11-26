import { Expose, Transform } from "class-transformer";
import path from "node:path";

export class UserResponseDto {

    @Expose()
    id:string

    @Expose()
    @Transform(obj => {
        let value = obj.value as string
        if(value){
            value =  value.replaceAll("\\", "\/")
        }

        return `${process.env.BASE_PATH}/${value}`
    })
    
    avatar:string

    @Expose()
    fullName:string

    @Expose()
    email:string

    @Expose()
    phone:string

    @Expose()
    role:string

    @Expose()
    email_verified:boolean

    @Expose()
    is_deleted:boolean
}