import {createHmac,timingSafeEqual} from "node:crypto";

/** A reset session must prove a successful one-time-password login.
 * The proof is bound to the current hashed, randomly rotated password.
 * Old sessions do not carry this proof and cannot replace a fresh password.
 */
export function passwordSetupProof(passwordHash:string,secret:string):string{
  return createHmac("sha256",secret)
    .update("b2b:password-setup:"+passwordHash)
    .digest("base64url");
}
export function validPasswordSetupProof(presented:unknown,passwordHash:string,secret:string):boolean{
  const expected=passwordSetupProof(passwordHash,secret);
  if(typeof presented!=="string"||presented.length!==expected.length)return false;
  return timingSafeEqual(Buffer.from(presented),Buffer.from(expected));
}
export function normalizedB2BCustomerEmail(value:unknown):string|null {
  if(typeof value!=="string")return null;
  const email=value.trim().toLowerCase();
  if(!email||email.length>254||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return null;
  return email;
}
