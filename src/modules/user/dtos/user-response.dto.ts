import { Expose, Transform } from "class-transformer";

export class UserResponseDto {

    @Expose()
    id:string

    @Expose()
    @Transform(obj => {
            
        if(obj.value){
            let value = obj.value as string
            value =  value.replaceAll("\\", "\/")
                return `${value}`
        }
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
    @Transform(obj => {
        return new Date(obj.value).toLocaleDateString()
    })
    dob:string

    @Expose({
        groups: ['admin']
    })
    email_verified:boolean

    @Expose({
        groups: ['admin']
    })
    is_deleted:boolean
    
    @Expose({
        groups: ['admin']
    })
    is_blocked:boolean

    @Expose({
        groups: ['admin']
    })
    subscription_end_at:Date    

    @Expose({
        groups: ['admin']
    })
    is_subscription_active:boolean

    @Expose({
        groups: ['admin']
    })
    total_created_sessions:number

   

}