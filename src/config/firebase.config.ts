import { registerAs } from "@nestjs/config"

export const firebaseConfig = () => ({
    firebase_secrets: process.env.FIREBASE_SECRETS
})

export default registerAs("firebase", firebaseConfig)