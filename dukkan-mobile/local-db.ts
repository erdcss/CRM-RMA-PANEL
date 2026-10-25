import * as SQLite from 'expo-sqlite';
// Exactly the same SQLite table structure as the standalone Windows edition.
export const DUKKAN_SCHEMA = "\nPRAGMA foreign_keys=ON;\nCREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);\nCREATE TABLE IF NOT EXISTS parties(id INTEGER PRIMARY KEY,name TEXT NOT NULL,kind TEXT NOT NULL DEFAULT 'both',tax_id TEXT DEFAULT '',phone TEXT DEFAULT '',email TEXT DEFAULT '',address TEXT DEFAULT '',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);\nCREATE TABLE IF NOT EXISTS products(id INTEGER PRIMARY KEY,code TEXT NOT NULL UNIQUE,barcode TEXT UNIQUE,name TEXT NOT NULL,unit TEXT NOT NULL DEFAULT 'Adet',stock_milli INTEGER NOT NULL DEFAULT 0 CHECK(stock_milli>=0),purchase_cents INTEGER NOT NULL DEFAULT 0,sale_cents INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);\nCREATE TABLE IF NOT EXISTS invoices(id INTEGER PRIMARY KEY,kind TEXT NOT NULL CHECK(kind IN ('sale','purchase','sale_return','purchase_return')),number TEXT NOT NULL,date TEXT NOT NULL,party_id INTEGER NOT NULL REFERENCES parties(id),net_cents INTEGER NOT NULL,vat_cents INTEGER NOT NULL,total_cents INTEGER NOT NULL,notes TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(kind,number));\nCREATE TABLE IF NOT EXISTS invoice_lines(id INTEGER PRIMARY KEY,invoice_id INTEGER NOT NULL REFERENCES invoices(id),product_id INTEGER NOT NULL REFERENCES products(id),qty_milli INTEGER NOT NULL CHECK(qty_milli>0),price_cents INTEGER NOT NULL CHECK(price_cents>=0),vat_rate INTEGER NOT NULL,net_cents INTEGER NOT NULL,vat_cents INTEGER NOT NULL,total_cents INTEGER NOT NULL);\nCREATE TABLE IF NOT EXISTS stock_movements(id INTEGER PRIMARY KEY,product_id INTEGER NOT NULL REFERENCES products(id),delta_milli INTEGER NOT NULL,reason TEXT NOT NULL,ref_type TEXT NOT NULL,ref_id INTEGER,note TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);\nCREATE TABLE IF NOT EXISTS ledger(id INTEGER PRIMARY KEY,party_id INTEGER NOT NULL REFERENCES parties(id),amount_cents INTEGER NOT NULL,description TEXT NOT NULL,ref_type TEXT NOT NULL,ref_id INTEGER,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);\nCREATE TABLE IF NOT EXISTS banks(id INTEGER PRIMARY KEY,name TEXT NOT NULL,iban TEXT DEFAULT '',currency TEXT NOT NULL DEFAULT 'TRY',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);\nCREATE TABLE IF NOT EXISTS bank_movements(id INTEGER PRIMARY KEY,bank_id INTEGER NOT NULL REFERENCES banks(id),amount_cents INTEGER NOT NULL,description TEXT NOT NULL,ref_type TEXT NOT NULL,ref_id INTEGER,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);\nCREATE TABLE IF NOT EXISTS cash_movements(id INTEGER PRIMARY KEY,amount_cents INTEGER NOT NULL,description TEXT NOT NULL,ref_type TEXT NOT NULL,ref_id INTEGER,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);\nCREATE TABLE IF NOT EXISTS payments(id INTEGER PRIMARY KEY,party_id INTEGER NOT NULL REFERENCES parties(id),kind TEXT NOT NULL CHECK(kind IN ('collection','payment')),method TEXT NOT NULL CHECK(method IN ('cash','bank')),bank_id INTEGER REFERENCES banks(id),amount_cents INTEGER NOT NULL CHECK(amount_cents>0),description TEXT NOT NULL DEFAULT '',date TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);\nCREATE TABLE IF NOT EXISTS instruments(id INTEGER PRIMARY KEY,party_id INTEGER NOT NULL REFERENCES parties(id),kind TEXT NOT NULL CHECK(kind IN ('cheque','note')),direction TEXT NOT NULL CHECK(direction IN ('received','issued')),number TEXT NOT NULL,amount_cents INTEGER NOT NULL CHECK(amount_cents>0),due_date TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','collected','bounced','cancelled')),bank_name TEXT DEFAULT '',description TEXT DEFAULT '',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);\nCREATE TABLE IF NOT EXISTS orders(id INTEGER PRIMARY KEY,kind TEXT NOT NULL CHECK(kind IN ('sale','purchase')),number TEXT NOT NULL,date TEXT NOT NULL,party_id INTEGER NOT NULL REFERENCES parties(id),status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','completed','cancelled')),notes TEXT NOT NULL DEFAULT '',total_cents INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(kind,number));\nCREATE TABLE IF NOT EXISTS order_lines(id INTEGER PRIMARY KEY,order_id INTEGER NOT NULL REFERENCES orders(id),product_id INTEGER NOT NULL REFERENCES products(id),qty_milli INTEGER NOT NULL,price_cents INTEGER NOT NULL,total_cents INTEGER NOT NULL);\nCREATE INDEX IF NOT EXISTS idx_ledger_party ON ledger(party_id);\nCREATE INDEX IF NOT EXISTS idx_stock_product ON stock_movements(product_id);\nCREATE INDEX IF NOT EXISTS idx_invoice_date ON invoices(date);\n";

export type RecordRow = Record<string, string | number | null>;
export type Collection = "products"|"parties"|"invoices"|"movements"|"ledger"|"banks"|"bank_movements"|"cash_movements"|"payments"|"instruments"|"orders";
type Tx = SQLite.SQLiteDatabase;
let database: SQLite.SQLiteDatabase | undefined;
const num = (v: unknown) => {const parsed=Number(String(v??"").trim().replace(",","."));if(!Number.isFinite(parsed)) throw new Error("Sayısal değer geçersiz"); return parsed;};
const amount = (v:unknown,zero=false) => {const n=num(v);if(n<0||(!zero&&n===0)||n>1e10||Math.abs(n*100-Math.round(n*100))>0.00001)throw new Error("Geçerli bir TL tutarı girin (en fazla 2 ondalık)");return Math.round(n*100);};
const count = (v:unknown) => {const n=num(v);if(n<=0||n>1e7||Math.abs(n*1000-Math.round(n*1000))>0.00001)throw new Error("Miktar sıfırdan büyük ve en fazla 3 ondalıklı olmalı");return Math.round(n*1000);};
const positiveId = (v:unknown) => {const n=Number(v);if(!Number.isSafeInteger(n)||n<1)throw new Error("Seçilen kayıt geçersiz");return n;};
const text = (v:unknown,label="Bilgi")=> {const value=String(v??"").trim();if(!value||value.length>200)throw new Error(label+" boş veya çok uzun");return value;};
const optional = (v:unknown,max=1000)=> {const value=String(v??"").trim();if(value.length>max)throw new Error("Açıklama çok uzun");return value;};
const valid = (v:unknown,values:string[]) => {const s=String(v);if(!values.includes(s))throw new Error("İşlem türü geçersiz");return s;};
const validDate = (v:unknown)=>{const s=String(v??"");if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||Number.isNaN(Date.parse(s)))throw new Error("Tarih YYYY-AA-GG olmalı");return s;};
export const today=()=>{const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");};
const query = async<T extends object=RecordRow>(sql:string,params:(string|number|null)[]=[]) => (await getDb()).getAllAsync<T>(sql,params);
const first = async<T extends object=RecordRow>(sql:string,params:(string|number|null)[]=[]) => (await getDb()).getFirstAsync<T>(sql,params);
export async function getDb(){
 if(!database){
  const db=await SQLite.openDatabaseAsync("dukkan.sqlite");
  await db.execAsync("PRAGMA foreign_keys=ON;");
  await db.execAsync(DUKKAN_SCHEMA);
  await db.execAsync("INSERT OR IGNORE INTO settings(key,value) VALUES ('company','İşletmem'),('phone',''),('tax',''),('address','');");
  database=db;
 }
 return database;
}
export async function closeDb(){if(database){await database.closeAsync();database=undefined;}}
async function foreign(tx:Tx,table:"products"|"parties"|"banks",id:unknown){
 const n=positiveId(id),row=await tx.getFirstAsync("SELECT id FROM "+table+" WHERE id=?",[n]);
 if(!row)throw new Error("Seçilen "+table+" kaydı bulunamadı");return n;
}
async function transaction<T>(fn:(db:Tx)=>Promise<T>):Promise<T>{
 const db=await getDb();let result!:T;
 await db.withExclusiveTransactionAsync(async tx=>{result=await fn(tx as Tx);});
 return result;
}
const queries:Record<Collection,string>={
 products:"SELECT * FROM products ORDER BY name COLLATE NOCASE LIMIT 3000",
 parties:"SELECT p.*,COALESCE((SELECT SUM(amount_cents) FROM ledger WHERE party_id=p.id),0) AS balance FROM parties p ORDER BY name COLLATE NOCASE LIMIT 3000",
 invoices:"SELECT i.*,p.name AS party_name FROM invoices i JOIN parties p ON p.id=i.party_id ORDER BY i.id DESC LIMIT 3000",
 movements:"SELECT m.*,p.name AS product_name,p.code FROM stock_movements m JOIN products p ON p.id=m.product_id ORDER BY m.id DESC LIMIT 3000",
 ledger:"SELECT l.*,p.name AS party_name FROM ledger l JOIN parties p ON p.id=l.party_id ORDER BY l.id DESC LIMIT 3000",
 banks:"SELECT b.*,COALESCE((SELECT SUM(amount_cents) FROM bank_movements WHERE bank_id=b.id),0) AS balance FROM banks b ORDER BY b.id DESC",
 bank_movements:"SELECT m.*,b.name AS bank_name FROM bank_movements m JOIN banks b ON b.id=m.bank_id ORDER BY m.id DESC LIMIT 3000",
 cash_movements:"SELECT * FROM cash_movements ORDER BY id DESC LIMIT 3000",
 payments:"SELECT t.*,p.name AS party_name,b.name AS bank_name FROM payments t JOIN parties p ON p.id=t.party_id LEFT JOIN banks b ON b.id=t.bank_id ORDER BY t.id DESC LIMIT 3000",
 instruments:"SELECT c.*,p.name AS party_name FROM instruments c JOIN parties p ON p.id=c.party_id ORDER BY c.due_date LIMIT 3000",
 orders:"SELECT o.*,p.name AS party_name FROM orders o JOIN parties p ON p.id=o.party_id ORDER BY o.id DESC LIMIT 3000"
};
export async function list(kind:Collection):Promise<RecordRow[]> {if(!Object.prototype.hasOwnProperty.call(queries,kind))throw new Error("Bölüm bulunamadı");return query(queries[kind]);}
export async function summary(){
 const q=async (sql:string)=>Number((await first<{value:number|null}>(sql))?.value||0);
 return {
  sales:await q("SELECT SUM(CASE WHEN kind='sale' THEN total_cents WHEN kind='sale_return' THEN -total_cents ELSE 0 END) value FROM invoices"),
  purchases:await q("SELECT SUM(CASE WHEN kind='purchase' THEN total_cents WHEN kind='purchase_return' THEN -total_cents ELSE 0 END) value FROM invoices"),
  receivables:await q("SELECT SUM(CASE WHEN balance>0 THEN balance ELSE 0 END) value FROM (SELECT SUM(amount_cents) balance FROM ledger GROUP BY party_id)"),
  payables:await q("SELECT SUM(CASE WHEN balance<0 THEN -balance ELSE 0 END) value FROM (SELECT SUM(amount_cents) balance FROM ledger GROUP BY party_id)"),
  stockCost:await q("SELECT SUM(stock_milli*purchase_cents/1000) value FROM products"),
  cash:await q("SELECT SUM(amount_cents) value FROM cash_movements"),
  bank:await q("SELECT SUM(amount_cents) value FROM bank_movements"),
  products:await q("SELECT COUNT(*) value FROM products"),
  parties:await q("SELECT COUNT(*) value FROM parties"),
  documents:await q("SELECT COUNT(*) value FROM invoices"),
  overdue:await q("SELECT COUNT(*) value FROM instruments WHERE status='pending' AND due_date<date('now')")
 };
}
export type Line={productId:number|string;qty:number|string;price:number|string;vat:number|string};
export type Form=Record<string,any>;
async function linesValidated(tx:Tx,input:Line[]){
 if(!Array.isArray(input)||input.length===0||input.length>100)throw new Error("En az bir ürün satırı gerekli");
 const out=[];
 for(const item of input){
  const id=await foreign(tx,"products",item.productId),q=count(item.qty),price=amount(item.price,true),tax=Number(item.vat);
  if(![0,1,10,20].includes(tax))throw new Error("Desteklenmeyen KDV");
  const net=Math.round(q*price/1000),vatCents=Math.round(net*tax/100);
  out.push({id,q,price,tax,net,vatCents,total:net+vatCents});
 }
 return out;
}
export async function add(kind:string,f:Form):Promise<number>{
 switch(kind){
  case "party":return transaction(async tx=>{
   const r=await tx.runAsync("INSERT INTO parties(name,kind,tax_id,phone,email,address) VALUES(?,?,?,?,?,?)",
    [text(f.name,"Cari adı"),valid(f.kind,["customer","supplier","both"]),optional(f.tax,30),optional(f.phone,50),optional(f.email,100),optional(f.address)]);
   return r.lastInsertRowId;
  });
  case "product":return transaction(async tx=>{
   const r=await tx.runAsync("INSERT INTO products(code,barcode,name,unit,purchase_cents,sale_cents) VALUES(?,?,?,?,?,?)",
    [text(f.code,"Ürün kodu"),optional(f.barcode,100)||null,text(f.name,"Ürün"),text(f.unit||"Adet","Birim"),amount(f.purchase,true),amount(f.sale,true)]);
   return r.lastInsertRowId;
  });
  case "stock":return transaction(async tx=>{
   const id=await foreign(tx,"products",f.productId),delta=count(f.qty)*(valid(f.direction,["increase","decrease"])==="increase"?1:-1);
   const r=await tx.runAsync("UPDATE products SET stock_milli=stock_milli+? WHERE id=? AND stock_milli+?>=0",[delta,id,delta]);
   if(r.changes!==1)throw new Error("Yetersiz stok");
   await tx.runAsync("INSERT INTO stock_movements(product_id,delta_milli,reason,ref_type,note) VALUES(?,?,?,?,?)",[id,delta,"sayım/düzeltme","manual",optional(f.notes)]);
   return id;
  });
  case "invoice":return transaction(async tx=>{
   const p=await foreign(tx,"parties",f.partyId),doc=valid(f.kind,["sale","purchase","sale_return","purchase_return"]),lines=await linesValidated(tx,f.lines);
   const net=lines.reduce((s,x)=>s+x.net,0),vat=lines.reduce((s,x)=>s+x.vatCents,0),total=net+vat;
   const invoice=await tx.runAsync("INSERT INTO invoices(kind,number,date,party_id,net_cents,vat_cents,total_cents,notes) VALUES(?,?,?,?,?,?,?,?)",
    [doc,text(f.number,"Belge numarası"),validDate(f.date),p,net,vat,total,optional(f.notes)]);
   const sign=["purchase","sale_return"].includes(doc)?1:-1;
   for(const l of lines){
    const updated=await tx.runAsync("UPDATE products SET stock_milli=stock_milli+? WHERE id=? AND stock_milli+?>=0",[sign*l.q,l.id,sign*l.q]);
    if(updated.changes!==1)throw new Error("Yetersiz stok: "+l.id);
    await tx.runAsync("INSERT INTO invoice_lines(invoice_id,product_id,qty_milli,price_cents,vat_rate,net_cents,vat_cents,total_cents) VALUES(?,?,?,?,?,?,?,?)",[invoice.lastInsertRowId,l.id,l.q,l.price,l.tax,l.net,l.vatCents,l.total]);
    await tx.runAsync("INSERT INTO stock_movements(product_id,delta_milli,reason,ref_type,ref_id,note) VALUES(?,?,?,?,?,?)",[l.id,sign*l.q,doc,"invoice",invoice.lastInsertRowId,f.number]);
   }
   const balanceSign=["sale","purchase_return"].includes(doc)?1:-1;
   await tx.runAsync("INSERT INTO ledger(party_id,amount_cents,description,ref_type,ref_id) VALUES(?,?,?,?,?)",
    [p,balanceSign*total,doc+" / "+f.number,"invoice",invoice.lastInsertRowId]);
   return invoice.lastInsertRowId;
  });
  case "payment":return transaction(async tx=>{
   const p=await foreign(tx,"parties",f.partyId),kind=valid(f.kind,["collection","payment"]),method=valid(f.method,["cash","bank"]);
   const bankId=method==="bank"?await foreign(tx,"banks",f.bankId):null;
   const total=amount(f.amount),date=validDate(f.date),notes=optional(f.notes);
   const pay=await tx.runAsync("INSERT INTO payments(party_id,kind,method,bank_id,amount_cents,description,date) VALUES(?,?,?,?,?,?,?)",[p,kind,method,bankId,total,notes,date]);
   const sign=kind==="collection"?1:-1;
   await tx.runAsync("INSERT INTO ledger(party_id,amount_cents,description,ref_type,ref_id) VALUES(?,?,?,?,?)",
    [p,-sign*total,(sign===1?"Tahsilat":"Ödeme")+" / "+date+" "+notes,"payment",pay.lastInsertRowId]);
   if(method==="cash")await tx.runAsync("INSERT INTO cash_movements(amount_cents,description,ref_type,ref_id) VALUES(?,?,?,?)",[sign*total,notes||kind,"payment",pay.lastInsertRowId]);
   else await tx.runAsync("INSERT INTO bank_movements(bank_id,amount_cents,description,ref_type,ref_id) VALUES(?,?,?,?,?)",[bankId,sign*total,notes||kind,"payment",pay.lastInsertRowId]);
   return pay.lastInsertRowId;
  });
  case "bank":return transaction(async tx=>(await tx.runAsync("INSERT INTO banks(name,iban) VALUES(?,?)",[text(f.name,"Banka"),optional(f.iban,40)])).lastInsertRowId);
  case "bankMovement":return transaction(async tx=>{
   const id=await foreign(tx,"banks",f.bankId),sign=valid(f.direction,["in","out"])==="in"?1:-1;
   return (await tx.runAsync("INSERT INTO bank_movements(bank_id,amount_cents,description,ref_type) VALUES(?,?,?,'manual')",[id,sign*amount(f.amount),text(f.notes,"Açıklama")])).lastInsertRowId;
  });
  case "cashMovement":return transaction(async tx=>{
   const sign=valid(f.direction,["in","out"])==="in"?1:-1;
   return (await tx.runAsync("INSERT INTO cash_movements(amount_cents,description,ref_type) VALUES(?,?,'manual')",[sign*amount(f.amount),text(f.notes,"Açıklama")])).lastInsertRowId;
  });
  case "instrument":return transaction(async tx=>{
   const id=await foreign(tx,"parties",f.partyId);
   return (await tx.runAsync("INSERT INTO instruments(party_id,kind,direction,number,amount_cents,due_date,status,bank_name,description) VALUES(?,?,?,?,?,?,'pending',?,?)",
    [id,valid(f.kind,["cheque","note"]),valid(f.direction,["received","issued"]),text(f.number,"Evrak no"),amount(f.amount),validDate(f.dueDate),optional(f.bankName,200),optional(f.notes)])).lastInsertRowId;
  });
  case "order":return transaction(async tx=>{
   const id=await foreign(tx,"parties",f.partyId),kind=valid(f.kind,["sale","purchase"]),lines=await linesValidated(tx,f.lines);
   const sum=lines.reduce((s,x)=>s+x.total,0);
   const order=await tx.runAsync("INSERT INTO orders(kind,number,date,party_id,notes,total_cents) VALUES(?,?,?,?,?,?)",
    [kind,text(f.number,"Sipariş numarası"),validDate(f.date),id,optional(f.notes),sum]);
   for(const l of lines)await tx.runAsync("INSERT INTO order_lines(order_id,product_id,qty_milli,price_cents,total_cents) VALUES(?,?,?,?,?)",[order.lastInsertRowId,l.id,l.q,l.price,l.total]);
   return order.lastInsertRowId;
  });
  case "settings":return transaction(async tx=>{
   for(const key of ["company","phone","tax","address"])await tx.runAsync("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",[key,optional(f[key],key==="address"?1000:200)]);
   return 1;
  });
  default:throw new Error("Bilinmeyen işlem");
 }
}
export async function setStatus(kind:"order"|"instrument",id:number,status:string){
 return transaction(async tx=>{
  const table=kind==="order"?"orders":"instruments";
  const allowed=kind==="order"?["completed","cancelled"]:["collected","bounced","cancelled"];
  const next=valid(status,allowed);
  const r=await tx.runAsync("UPDATE "+table+" SET status=? WHERE id=? AND status=?",[next,positiveId(id),kind==="order"?"open":"pending"]);
  if(r.changes!==1)throw new Error("Kayıt daha önce kapatılmış");return r.changes;
 });
}
export async function settings(){
 const data=await query<{key:string,value:string}>("SELECT key,value FROM settings");
 return Object.fromEntries(data.map(x=>[x.key,x.value]));
}
export async function report(){
 return {
  monthly:await query("SELECT substr(date,1,7) month,SUM(CASE WHEN kind='sale' THEN total_cents WHEN kind='sale_return' THEN -total_cents ELSE 0 END) sales,SUM(CASE WHEN kind='purchase' THEN total_cents WHEN kind='purchase_return' THEN -total_cents ELSE 0 END) purchases FROM invoices GROUP BY substr(date,1,7) ORDER BY month DESC LIMIT 24"),
  inventory:await query("SELECT code,name,stock_milli,purchase_cents,sale_cents,ROUND(stock_milli*purchase_cents/1000) AS value_cents FROM products ORDER BY name")
 };
}
