import type { Express } from "express";
import { eq, sql } from "drizzle-orm";
import { db } from "./db";
import { q } from "./auth";
import { catalogCustomers,catalogProducts,customers,supplierItems,tickets } from "@shared/schema";

export function registerAccountRoutes(app:Express):void{
 app.delete("/api/account",async(req,res)=>{try{
  const user=req.authUser;if(!user)return res.status(401).json({error:"Authentication required"});
  await db.delete(catalogProducts).where(eq(catalogProducts.ownerUserId,user.id));
  await db.delete(catalogCustomers).where(eq(catalogCustomers.ownerUserId,user.id));
  await db.delete(supplierItems).where(eq(supplierItems.ownerUserId,user.id));
  await db.delete(tickets).where(eq(tickets.ownerUserId,user.id));
  await db.execute(sql`DELETE FROM ${customers} WHERE NOT EXISTS (SELECT 1 FROM ${tickets} WHERE ${tickets.customerId}=${customers.id})`);
  await q("DELETE FROM auth_users WHERE id=$1",[user.id]);
  res.json({message:"Account deleted successfully"});
 }catch(e){console.error("Error deleting account:",e);res.status(500).json({error:"Failed to delete account"});}});
}
