import { Session } from "generated/prisma/client";

export interface SessionCreationStartegy {
    execute():Promise<Session>
}