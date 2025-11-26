import { Injectable } from "@nestjs/common";

@Injectable()
export class OtpGenerator{

    generate():number{
        return Math.round(Math.random() * 900000)
    }
}