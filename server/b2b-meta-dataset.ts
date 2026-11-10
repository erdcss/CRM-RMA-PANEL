import type {Pool} from "pg";

/** The Meta dataset / browser Pixel ID supplied by the business owner.
 * This is PUBLIC metadata, not a Conversions API access token.
 */
export const CALISKAN_META_PIXEL_ID="1496993098956595";
export const DATASET_ACTIVATION_MARKER="b2b_meta_dataset_1496993098956595_activated_v1";

export function requestedMetaTrackingConfig(previous:unknown):{enabled:boolean;pixelId:string}{
  let parsed:unknown=previous;
  if(typeof previous==="string"){
    try{parsed=JSON.parse(previous);}catch{parsed=null;}
  }
  const value=parsed&&typeof parsed==="object"&&!Array.isArray(parsed)
    ?parsed as Record<string,unknown>:{};
  // Preserve a previously disabled setting; never silently opt visitors in.
  return {enabled:value.enabled===false?false:true,pixelId:CALISKAN_META_PIXEL_ID};
}

/** One-time, transactional switch of the persisted web Pixel. Subsequent
 * admin edits are preserved on restart because the activation marker remains.
 * This must run only AFTER platform_settings has been initialized.
 */
export async function activateCaliskanMetaDataset(pool:Pick<Pool,"connect">):Promise<boolean>{
  const db=await pool.connect();
  try{
    await db.query("BEGIN");
    // Guard concurrent Railway replicas and startups.
    await db.query("SELECT pg_advisory_xact_lock($1::bigint)",[CALISKAN_META_PIXEL_ID]);
    const check=await db.query("SELECT 1 FROM platform_settings WHERE key=$1 LIMIT 1",[DATASET_ACTIVATION_MARKER]);
    if(check.rows.length){
      await db.query("COMMIT");
      return false;
    }
    const existing=await db.query("SELECT value FROM platform_settings WHERE key='b2b_meta_tracking' FOR UPDATE");
    const config=requestedMetaTrackingConfig(existing.rows[0]?.value);
    await db.query(
      "INSERT INTO platform_settings(key,value,updated_at) VALUES('b2b_meta_tracking',$1,NOW()) "+
      "ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=NOW()",
      [JSON.stringify(config)],
    );
    await db.query(
      "INSERT INTO platform_settings(key,value,updated_at) VALUES ($1,'applied',NOW()) "+
      "ON CONFLICT(key) DO NOTHING",
      [DATASET_ACTIVATION_MARKER],
    );
    await db.query("COMMIT");
    return true;
  }catch(error){
    await db.query("ROLLBACK").catch(()=>undefined);
    throw error;
  }finally{
    db.release();
  }
}
