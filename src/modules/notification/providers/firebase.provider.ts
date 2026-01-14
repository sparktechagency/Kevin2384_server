import { Inject, Injectable } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import  firebaseConfigType from "src/config/firebase.config";
import { App, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from "firebase-admin/messaging";

@Injectable()
export class FireBaseClient {

    private  app:App | undefined

    constructor( @Inject(firebaseConfigType.KEY) private readonly firebaseConfig:ConfigType<typeof firebaseConfigType>){
        try{
         this.initializeFirebaseApp()


        }catch(err){
            
           console.log(err)
        }
    }


    async sendPushNotification(tokens:string | string[], title:string, body:string){
        try{
            
            if(!this.app)
                throw new Error("Firebase client does not configured correctly")

            if(!tokens || tokens.length <= 0)
                throw new Error("FCM token is invalid")

            if(!title || !body){
                throw new Error ("Invalid title or body")
            }

            if(Array.isArray(tokens)){
                getMessaging().sendEachForMulticast({
                    tokens,
                    notification:{
                        title,
                        body
                    },
                })
            }else {

                getMessaging().send({
                    token:tokens,
                    notification:{
                        body,
                        title
                    }
                })
            }
        }catch(err){
            console.log("error sned push notification ", err)
            throw err
        }

       
       
    }

    private initializeFirebaseApp(){

        try{
            if(!this.firebaseConfig.firebase_secrets){
                throw new Error("Firebase initialization failed: Firebase secrets are invalid")
            }

            let app = initializeApp({credential: cert(JSON.parse(this.firebaseConfig.firebase_secrets))})
       

            this.app = app
    
        }
        catch(err){
            console.log("Failed to initialized firebased app: " ,err)
        }
    }

}