import { Inject, Injectable } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import stripeConfig, { StripeConfig } from "src/config/stripe.config";
import Stripe from "stripe";



@Injectable()
export class StripeProvider {
    private readonly stripeCLient:Stripe

    constructor(@Inject(stripeConfig.KEY) private readonly stripeCOnfiguration:ConfigType<typeof StripeConfig>){
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
                        images:["https://unsplash.com/photos/two-people-paddleboarding-at-sunset-I-t-BBFyUWY"]
                    
                    },
                    unit_amount:amount * 100
                },
                quantity:1
            }
        ]
        
    })

    return checkoutSession
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

        const onboardingLink = await this.stripeCLient.accountLinks.create({
            account:account.id,
            type:"account_onboarding",
            return_url:"http://google.com",
            refresh_url:"http://google.com",
            collection_options: {
                fields: 'currently_due',
            },
        })
    
        return {onboardingLink, account}
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

    
}