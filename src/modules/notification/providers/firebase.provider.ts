import { Inject, Injectable } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import  firebaseConfigType from "src/config/firebase.config";
import { initializeApp } from 'firebase-admin';
import { cert } from 'firebase-admin/app';

@Injectable()
export class FireBaseClient {

    private readonly app

    constructor( @Inject(firebaseConfigType.KEY) private readonly firebaseConfig:ConfigType<typeof firebaseConfigType>){
        try{
            this.app = this.initializeFirebaseAdmin()

        }catch(err){
            throw err
        }
    }


    async sendMessage(token:string){
       
    }

    private initializeFirebaseAdmin(){
        if(!this.firebaseConfig.firebase_secrets){
            throw new Error("Firebase initialization failed: Firebase secrets are invalid")
        }
       let app = initializeApp({credential: cert(JSON.parse(this.firebaseConfig.firebase_secrets)) })
       

       return app
    
    }

}