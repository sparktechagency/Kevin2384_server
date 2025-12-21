import { BadRequestException, Inject, Injectable, RawBodyRequest } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import { ParticipantPaymentStatus, PaymentStatus, PlayerStatus } from "generated/prisma/enums";
import stripeConfig, { StripeConfig } from "src/config/stripe.config";
import { PrismaService } from "src/modules/prisma/prisma.service";
import Stripe from "stripe";



type MetaData  = {
    paymentId:string
    participantId:string
    sessionId:string
}

@Injectable()
export class StripeProvider {
    private readonly stripeCLient:Stripe

    constructor(
        @Inject(stripeConfig.KEY) private readonly stripeCOnfiguration:ConfigType<typeof StripeConfig>,
        private readonly prismaService:PrismaService
){
        if(!stripeCOnfiguration.stripe_key){
            throw new Error("Stripe intialization failed. Please provde stripe secret key.")
        }

        this.stripeCLient = new Stripe(stripeCOnfiguration.stripe_key, {
            apiVersion:"2025-11-17.clover"
        })
    }


async createCheckoutSession(amount:number,item:{title:string, description:string}, paymentId:string, participantId:string, sessionId:string){
    const checkoutSession = await this.stripeCLient.checkout.sessions.create({
        mode:'payment',
        success_url:"http://www.google.com",
        metadata:{
            paymentId,
            participantId,
            sessionId
        },
        line_items:[
            {
                price_data:{
                    currency:"usd",
                    product_data:{
                        name:item.title,
                        description:item.description,
                    },
                    unit_amount:amount * 100
                },
                quantity:1
            }
        ]
        
    })

    return checkoutSession.url
}

    async createStripeAccount(){

        const account = await this.stripeCLient.accounts.create({
            controller:{
                fees:{payer:'application'},
                losses:{
                    payments:"application"
                },
                stripe_dashboard:{
                    type:'express'
                }
            },
        })

       
    
        return  account
    }

    async generateAccountLink (accountId:string){

         const onboardingLink = await this.stripeCLient.accountLinks.create({
            account:accountId,
            type:"account_onboarding",
            return_url:"http://google.com",
            refresh_url:"http://google.com",
            collection_options: {
                fields: 'currently_due',
            },
            
        })

        return onboardingLink
    }

    async checkAccountStatus(accountId:string){

    }

    async retriveAccount(accountId:string){
        return await this.stripeCLient.accounts.retrieve(accountId)
    }

    async deleteStripeAccount(accountId:string){
        try{
            const stripeAccount = await this.retriveAccount(accountId)
            await this.stripeCLient.accounts.del(stripeAccount.id)
        }catch(err){
            console.log(err)
            throw err
        }
        
    }

    async transfer(amount:number, accountId:string){
        try{
            const account = await this.retriveAccount(accountId)
            this.stripeCLient.transfers.create({
                destination:account.id,
                amount:amount,
                currency:"usd",
            })
        }catch(err){
            console.log("Tranferring amount error!")
            throw err
        }
      

    }

    async handleWebhook(stripe_signature:string, req:RawBodyRequest<Request>){

    if(!this.stripeCOnfiguration.webhook_key){
      throw new BadRequestException("webhook key is required")
    }

    if(!stripe_signature){
        throw new BadRequestException("stripe signature is missing!")
    }

     const event = this.stripeCLient.webhooks.constructEvent(
        req.rawBody!,
        stripe_signature,
        this.stripeCOnfiguration.webhook_key
    );

    switch(event.type){
        
        case "checkout.session.completed":{
            const {paymentId, participantId, sessionId} = event.data.object.metadata as MetaData

            await this.prismaService.$transaction([
                this.prismaService.payment.update({where:{id:paymentId}, data:{status:PaymentStatus.Succeeded}}),
                this.prismaService.sessionParticipant.update({where:{id:participantId}, data:{payment_status:ParticipantPaymentStatus.Paid, player_status:PlayerStatus.Attending}})
            ])
            break
        }
        case "payment_intent.payment_failed":{
            let {paymentId, participantId, sessionId} = event.data.object.metadata as MetaData

            await this.prismaService.$transaction([
                this.prismaService.payment.update({where:{id:paymentId}, data:{status:PaymentStatus.Failed}}),
                this.prismaService.sessionParticipant.update({where:{id:participantId}, data:{payment_status:ParticipantPaymentStatus.Failed, player_status:PlayerStatus.Cancelled}})
            ])

            break
        }
        default:

    }


    return event.data
  }

    
}