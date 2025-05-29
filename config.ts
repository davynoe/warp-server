// Load environment variables from .env file
import { load } from "https://deno.land/std@0.208.0/dotenv/mod.ts";
await load({ export: true });

export const config = {
  mongodb: {
    connectionString: Deno.env.get("MONGODB_URI"),
    dbName: Deno.env.get("DB_NAME"),
  },
};
