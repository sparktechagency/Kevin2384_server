import { Expose } from "class-transformer"

export class SignInResponseDto{

    @Expose()
    id:string

    @Expose()
    fullName:string

    @Expose()
    email:string

    @Expose()
    phone:string

    @Expose()
    email_verified:boolean

    @Expose()
    role:string

    @Expose()
    token:string

    @Expose()
    free_trial_expires_at:Date

    @Expose()
    free_trial_expired:boolean
    
    @Expose()
    first_time_logged_in_after_trial_started:boolean


}