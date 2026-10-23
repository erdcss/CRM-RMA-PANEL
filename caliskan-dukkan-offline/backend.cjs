"use strict";
// Çalışkan Dükkan: tamamen yerel SQLite veritabanı. Ağ veya Çalışkan Admin bağlantısı yoktur.
const fs=require("node:fs");
const path=require("node:path");
const initSqlJs=require("sql.js");
let db,dbFile,SQL;
const schema=String.raw`
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS parties(id INTEGER PRIMARY KEY,name TEXT NOT NULL,kind TEXT NOT NULL DEFAULT 'both',tax_id TEXT DEFAULT '',phone TEXT DEFAULT '',email TEXT DEFAULT '',address TEXT DEFAULT '',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS products(id INTEGER PRIMARY KEY,code TEXT NOT NULL UNIQUE,barcode TEXT UNIQUE,name TEXT NOT NULL,unit TEXT NOT NULL DEFAULT 'Adet',stock_milli INTEGER NOT NULL DEFAULT 0 CHECK(stock_milli>=0),purchase_cents INTEGER NOT NULL DEFAULT 0,sale_cents INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS invoices(id INTEGER PRIMARY KEY,kind TEXT NOT NULL CHECK(kind IN ('sale','purchase','sale_return','purchase_return')),number TEXT NOT NULL,date TEXT NOT NULL,party_id INTEGER NOT NULL REFERENCES parties(id),net_cents INTEGER NOT NULL,vat_cents INTEGER NOT NULL,total_cents INTEGER NOT NULL,notes TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(kind,number));
CREATE TABLE IF NOT EXISTS invoice_lines(id INTEGER PRIMARY KEY,invoice_id INTEGER NOT NULL REFERENCES invoices(id),product_id INTEGER NOT NULL REFERENCES products(id),qty_milli INTEGER NOT NULL CHECK(qty_milli>0),price_cents INTEGER NOT NULL CHECK(price_cents>=0),vat_rate INTEGER NOT NULL,net_cents INTEGER NOT NULL,vat_cents INTEGER NOT NULL,total_cents INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS stock_movements(id INTEGER PRIMARY KEY,product_id INTEGER NOT NULL REFERENCES products(id),delta_milli INTEGER NOT NULL,reason TEXT NOT NULL,ref_type TEXT NOT NULL,ref_id INTEGER,note TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS ledger(id INTEGER PRIMARY KEY,party_id INTEGER NOT NULL REFERENCES parties(id),amount_cents INTEGER NOT NULL,description TEXT NOT NULL,ref_type TEXT NOT NULL,ref_id INTEGER,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS banks(id INTEGER PRIMARY KEY,name TEXT NOT NULL,iban TEXT DEFAULT '',currency TEXT NOT NULL DEFAULT 'TRY',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS bank_movements(id INTEGER PRIMARY KEY,bank_id INTEGER NOT NULL REFERENCES banks(id),amount_cents INTEGER NOT NULL,description TEXT NOT NULL,ref_type TEXT NOT NULL,ref_id INTEGER,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS cash_movements(id INTEGER PRIMARY KEY,amount_cents INTEGER NOT NULL,description TEXT NOT NULL,ref_type TEXT NOT NULL,ref_id INTEGER,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS payments(id INTEGER PRIMARY KEY,party_id INTEGER NOT NULL REFERENCES parties(id),kind TEXT NOT NULL CHECK(kind IN ('collection','payment')),method TEXT NOT NULL CHECK(method IN ('cash','bank')),bank_id INTEGER REFERENCES banks(id),amount_cents INTEGER NOT NULL CHECK(amount_cents>0),description TEXT NOT NULL DEFAULT '',date TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS instruments(id INTEGER PRIMARY KEY,party_id INTEGER NOT NULL REFERENCES parties(id),kind TEXT NOT NULL CHECK(kind IN ('cheque','note')),direction TEXT NOT NULL CHECK(direction IN ('received','issued')),number TEXT NOT NULL,amount_cents INTEGER NOT NULL CHECK(amount_cents>0),due_date TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','collected','bounced','cancelled')),bank_name TEXT DEFAULT '',description TEXT DEFAULT '',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS orders(id INTEGER PRIMARY KEY,kind TEXT NOT NULL CHECK(kind IN ('sale','purchase')),number TEXT NOT NULL,date TEXT NOT NULL,party_id INTEGER NOT NULL REFERENCES parties(id),status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','completed','cancelled')),notes TEXT NOT NULL DEFAULT '',total_cents INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(kind,number));
CREATE TABLE IF NOT EXISTS order_lines(id INTEGER PRIMARY KEY,order_id INTEGER NOT NULL REFERENCES orders(id),product_id INTEGER NOT NULL REFERENCES products(id),qty_milli INTEGER NOT NULL,price_cents INTEGER NOT NULL,total_cents INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_ledger_party ON ledger(party_id);
CREATE INDEX IF NOT EXISTS idx_stock_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_invoice_date ON invoices(date);
`;
function rows(sql,params=[]){const st=db.prepare(sql);try{st.bind(params);const out=[];while(st.step())out.push(st.getAsObject());return out;}finally{st.free();}}
function row(sql,params=[]){return rows(sql,params)[0]||null;}
function run(sql,params=[]){db.run(sql,params);return Number(row("SELECT last_insert_rowid() AS id").id);}
function requireId(v,label="Kayıt"){const n=Number(v);if(!Number.isSafeInteger(n)||n<1)throw Error(label+" seçimi geçersiz");return n;}
function required(v,label="Alan",max=200){const s=String(v??"").trim();if(!s||s.length>max)throw Error(label+" boş olamaz / çok uzun");return s;}
function optional(v,max=1000){const s=String(v??"").trim();if(s.length>max)throw Error("Açıklama çok uzun");return s;}
function one(v,allowed){if(!allowed.includes(v))throw Error("Geçersiz işlem türü");return v;}
function date(v){const s=required(v,"Tarih",10);if(!/^\d{4}-\d\d-\d\d$/.test(s)||Number.isNaN(Date.parse(s)))throw Error("Tarih YYYY-AA-GG biçiminde olmalı");return s;}
function dec(v){let s=String(v??"").trim();if(/^-?\d{1,3}(\.\d{3})+,\d+$/.test(s))s=s.replaceAll(".","").replace(",",".");else if(s.includes(",")&&!s.includes("."))s=s.replace(",",".");const n=Number(s);if(!Number.isFinite(n))throw Error("Geçersiz sayısal değer");return n;}
function cents(v,allowZero=false){const n=dec(v);if(n<0||(!allowZero&&n===0)||n>1e11||Math.abs(n*100-Math.round(n*100))>1e-5)throw Error("Tutar sıfırdan büyük, en fazla 2 ondalıklı olmalı");return Math.round(n*100);}
function milli(v){const n=dec(v);if(n<=0||n>1e7||Math.abs(n*1000-Math.round(n*1000))>1e-5)throw Error("Miktar sıfırdan büyük ve en fazla 3 ondalıklı olmalı");return Math.round(n*1000);}
function whole(v,name){const n=Number(v);if(!Number.isInteger(n)||n<0||n>100)throw Error(name+" hatalı");return n;}
function exists(table,id){const obj=row("SELECT id FROM "+table+" WHERE id=?",[requireId(id)]);if(!obj)throw Error("Seçilen kayıt bulunamadı");return Number(obj.id);}
function freshCopy(){if(!dbFile)return;const stamp=new Date().toISOString().slice(0,10);const backupDir=path.join(path.dirname(dbFile),"otomatik-yedekler");fs.mkdirSync(backupDir,{recursive:true});const p=path.join(backupDir,"dukkan-"+stamp+".sqlite");if(!fs.existsSync(p)&&fs.existsSync(dbFile))fs.copyFileSync(dbFile,p);}
function persist(){if(!dbFile)return;const tmp=dbFile+".tmp";fs.writeFileSync(tmp,Buffer.from(db.export()));fs.renameSync(tmp,dbFile);}
function transaction(fn){db.run("BEGIN IMMEDIATE");try{const result=fn();db.run("COMMIT");persist();return result;}catch(e){try{db.run("ROLLBACK");}catch{}throw e;}}
async function initialize(file){
  const wasm=path.join(__dirname,"node_modules","sql.js","dist","sql-wasm.wasm");
  SQL=await initSqlJs({wasmBinary:fs.readFileSync(wasm)});
  dbFile=file;
  if(file){fs.mkdirSync(path.dirname(file),{recursive:true});freshCopy();}
  db=file&&fs.existsSync(file)?new SQL.Database(new Uint8Array(fs.readFileSync(file))):new SQL.Database();
  db.run(schema);
  db.run("PRAGMA foreign_keys=ON");
  db.run("INSERT OR IGNORE INTO settings(key,value) VALUES ('company','İşletmem'),('phone',''),('tax',''),('address','')");
  persist();
}
function backup(){return Buffer.from(db.export());}
function restore(buf){
  const next=new SQL.Database(new Uint8Array(buf));
  const names=next.exec("SELECT name FROM sqlite_master WHERE type='table'").flatMap(x=>x.values.flat()).map(String);
  if(!["invoices","products","parties","ledger","settings"].every(t=>names.includes(t))){next.close();throw Error("Seçilen dosya geçerli Çalışkan Dükkan yedeği değil");}
  const integrity=next.exec("PRAGMA integrity_check")[0]?.values[0]?.[0];
  if(integrity!=="ok"){next.close();throw Error("Yedek veritabanı bütünlük kontrolünü geçemedi");}
  next.run("PRAGMA foreign_keys=ON");const old=db;db=next;try{persist();old.close();}catch(e){db=old;next.close();throw e;}
}
const lists={
  products:"SELECT * FROM products ORDER BY name COLLATE NOCASE LIMIT 3000",
  parties:"SELECT p.*,COALESCE((SELECT SUM(amount_cents) FROM ledger WHERE party_id=p.id),0) AS balance FROM parties p ORDER BY p.name COLLATE NOCASE LIMIT 3000",
  invoices:"SELECT i.*,p.name AS party_name FROM invoices i JOIN parties p ON p.id=i.party_id ORDER BY i.id DESC LIMIT 3000",
  movements:"SELECT m.*,p.name AS product_name,p.code FROM stock_movements m JOIN products p ON p.id=m.product_id ORDER BY m.id DESC LIMIT 3000",
  ledger:"SELECT l.*,p.name AS party_name FROM ledger l JOIN parties p ON p.id=l.party_id ORDER BY l.id DESC LIMIT 3000",
  banks:"SELECT b.*,COALESCE((SELECT SUM(amount_cents) FROM bank_movements WHERE bank_id=b.id),0) AS balance FROM banks b ORDER BY b.id DESC",
  bank_movements:"SELECT m.*,b.name AS bank_name FROM bank_movements m JOIN banks b ON b.id=m.bank_id ORDER BY m.id DESC LIMIT 3000",
  cash_movements:"SELECT * FROM cash_movements ORDER BY id DESC LIMIT 3000",
  payments:"SELECT t.*,p.name AS party_name,b.name AS bank_name FROM payments t JOIN parties p ON p.id=t.party_id LEFT JOIN banks b ON b.id=t.bank_id ORDER BY t.id DESC LIMIT 3000",
  instruments:"SELECT c.*,p.name AS party_name FROM instruments c JOIN parties p ON p.id=c.party_id ORDER BY c.due_date ASC LIMIT 3000",
  orders:"SELECT o.*,p.name AS party_name FROM orders o JOIN parties p ON p.id=o.party_id ORDER BY o.id DESC LIMIT 3000"
};
function queryList(name){if(!Object.hasOwn(lists,name))throw Error("Bölüm bulunamadı");return rows(lists[name]);}
function dashboard(){
  const s=(q)=>Number(row(q).v||0);
  return {sales:s("SELECT SUM(CASE WHEN kind='sale' THEN total_cents WHEN kind='sale_return' THEN -total_cents ELSE 0 END) v FROM invoices"),
    purchases:s("SELECT SUM(CASE WHEN kind='purchase' THEN total_cents WHEN kind='purchase_return' THEN -total_cents ELSE 0 END) v FROM invoices"),
    products:s("SELECT COUNT(*) v FROM products"),parties:s("SELECT COUNT(*) v FROM parties"),invoices:s("SELECT COUNT(*) v FROM invoices"),
    stockCost:s("SELECT SUM(stock_milli*purchase_cents/1000) v FROM products"),
    receivables:s("SELECT SUM(CASE WHEN balance>0 THEN balance ELSE 0 END) v FROM (SELECT SUM(amount_cents) balance FROM ledger GROUP BY party_id)"),
    payables:s("SELECT SUM(CASE WHEN balance<0 THEN -balance ELSE 0 END) v FROM (SELECT SUM(amount_cents) balance FROM ledger GROUP BY party_id)"),
    cash:s("SELECT SUM(amount_cents) v FROM cash_movements"),bank:s("SELECT SUM(amount_cents) v FROM bank_movements"),
    overdue:s("SELECT COUNT(*) v FROM instruments WHERE status='pending' AND due_date<date('now')"),
    lowStock:rows("SELECT id,code,name,stock_milli FROM products WHERE stock_milli<5000 ORDER BY stock_milli LIMIT 12"),
    recent:rows("SELECT i.id,i.number,i.kind,i.date,i.total_cents,p.name AS party_name FROM invoices i JOIN parties p ON p.id=i.party_id ORDER BY i.id DESC LIMIT 10")};
}
function docLines(lines){if(!Array.isArray(lines)||lines.length<1||lines.length>150)throw Error("En az bir ürün satırı ekleyin");return lines.map(x=>{
  const productId=exists("products",x.productId);
  const q=milli(x.qty),price=cents(x.price,true),vat=whole(x.vat,"KDV");
  if(![0,1,10,20].includes(vat))throw Error("Desteklenmeyen KDV oranı");
  const net=Math.round(q*price/1000),tax=Math.round(net*vat/100),total=net+tax;
  return {productId,q,price,vat,net,tax,total};
});}
function saveInvoice(p){
  const kind=one(p.kind,["sale","purchase","sale_return","purchase_return"]);
  const number=required(p.number,"Fatura numarası",80),dt=date(p.date),partyId=exists("parties",p.partyId);
  const lines=docLines(p.lines);
  const net=lines.reduce((a,x)=>a+x.net,0),vat=lines.reduce((a,x)=>a+x.tax,0),total=net+vat;
  const sign=["purchase","sale_return"].includes(kind)?1:-1;
  for(const l of lines){
    const product=row("SELECT stock_milli,name FROM products WHERE id=?",[l.productId]);
    const incoming=Number(product.stock_milli)+sign*l.q;
    // repeated product rows are validated again during transactional stock update
    if(incoming<0)throw Error("Yetersiz stok: "+product.name);
  }
  const id=run("INSERT INTO invoices(kind,number,date,party_id,net_cents,vat_cents,total_cents,notes) VALUES (?,?,?,?,?,?,?,?)",[kind,number,dt,partyId,net,vat,total,optional(p.notes)]);
  for(const l of lines){
    db.run("UPDATE products SET stock_milli=stock_milli+? WHERE id=? AND stock_milli+?>=0",[sign*l.q,l.productId,sign*l.q]);
    if(db.getRowsModified()!==1)throw Error("Stok yetersiz; fatura geri alındı");
    run("INSERT INTO invoice_lines(invoice_id,product_id,qty_milli,price_cents,vat_rate,net_cents,vat_cents,total_cents) VALUES(?,?,?,?,?,?,?,?)",[id,l.productId,l.q,l.price,l.vat,l.net,l.tax,l.total]);
    run("INSERT INTO stock_movements(product_id,delta_milli,reason,ref_type,ref_id,note) VALUES(?,?,?,?,?,?)",[l.productId,sign*l.q,kind,"invoice",id,number]);
  }
  const balanceSign=["sale","purchase_return"].includes(kind)?1:-1;
  run("INSERT INTO ledger(party_id,amount_cents,description,ref_type,ref_id) VALUES(?,?,?,?,?)",[partyId,balanceSign*total,kind+" / "+number,"invoice",id]);
  return {id,number,total_cents:total};
}
function invoiceDetails(id){
  const invoice=row("SELECT i.*,p.name AS party_name,p.tax_id,p.address AS party_address FROM invoices i JOIN parties p ON p.id=i.party_id WHERE i.id=?",[requireId(id)]);
  if(!invoice)throw Error("Fatura bulunamadı");
  invoice.lines=rows("SELECT l.*,p.name AS product_name,p.code,p.unit FROM invoice_lines l JOIN products p ON p.id=l.product_id WHERE invoice_id=?",[invoice.id]);return invoice;
}
function payment(p){
  const partyId=exists("parties",p.partyId),kind=one(p.kind,["collection","payment"]),method=one(p.method,["cash","bank"]);
  const bankId=method==="bank"?exists("banks",p.bankId):null,amount=cents(p.amount),dt=date(p.date),notes=optional(p.notes);
  const id=run("INSERT INTO payments(party_id,kind,method,bank_id,amount_cents,description,date) VALUES(?,?,?,?,?,?,?)",[partyId,kind,method,bankId,amount,notes,dt]);
  const sign=kind==="collection"?1:-1;
  // Tahsilat cari borcu azaltır; yapılan ödeme tedarikçi borcunu azaltır.
  run("INSERT INTO ledger(party_id,amount_cents,description,ref_type,ref_id) VALUES(?,?,?,?,?)",[partyId,-sign*amount,(kind==="collection"?"Tahsilat":"Ödeme")+" / "+dt+" "+notes,"payment",id]);
  if(method==="cash")run("INSERT INTO cash_movements(amount_cents,description,ref_type,ref_id) VALUES(?,?,?,?)",[sign*amount,notes||kind,"payment",id]);
  else run("INSERT INTO bank_movements(bank_id,amount_cents,description,ref_type,ref_id) VALUES(?,?,?,?,?)",[bankId,sign*amount,notes||kind,"payment",id]);
  return {id};
}
function createOrder(p){
  const kind=one(p.kind,["sale","purchase"]),number=required(p.number,"Sipariş numarası",80),dt=date(p.date),partyId=exists("parties",p.partyId),lines=docLines(p.lines);
  const total=lines.reduce((a,x)=>a+x.total,0);
  const id=run("INSERT INTO orders(kind,number,date,party_id,notes,total_cents) VALUES(?,?,?,?,?,?)",[kind,number,dt,partyId,optional(p.notes),total]);
  for(const l of lines)run("INSERT INTO order_lines(order_id,product_id,qty_milli,price_cents,total_cents) VALUES(?,?,?,?,?)",[id,l.productId,l.q,l.price,l.total]);
  return {id};
}
async function execute(command,p={}){
  if(command==="dashboard")return dashboard();
  if(command==="list")return queryList(p.kind);
  if(command==="settings")return rows("SELECT key,value FROM settings");
  if(command==="invoice")return invoiceDetails(p.id);
  if(command==="order")return {...row("SELECT * FROM orders WHERE id=?",[requireId(p.id)]),lines:rows("SELECT l.*,p.name AS product_name,p.code FROM order_lines l JOIN products p ON p.id=l.product_id WHERE l.order_id=?",[requireId(p.id)])};
  if(command==="report")return {summary:dashboard(),monthly:rows("SELECT substr(date,1,7) month, SUM(CASE WHEN kind='sale' THEN total_cents WHEN kind='sale_return' THEN -total_cents ELSE 0 END) sales, SUM(CASE WHEN kind='purchase' THEN total_cents WHEN kind='purchase_return' THEN -total_cents ELSE 0 END) purchases FROM invoices GROUP BY substr(date,1,7) ORDER BY month DESC LIMIT 24"),inventory:rows("SELECT code,name,stock_milli,purchase_cents,sale_cents,ROUND(stock_milli*purchase_cents/1000) AS value_cents FROM products ORDER BY name"),balances:queryList("parties")};
  const actions={
    saveSettings:()=>{
      for(const key of ["company","phone","tax","address"]){db.run("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",[key,optional(p[key],key==="address"?1000:200)]);}
      return true;
    },
    addParty:()=>run("INSERT INTO parties(name,kind,tax_id,phone,email,address) VALUES(?,?,?,?,?,?)",[required(p.name,"Cari adı"),one(p.kind,["customer","supplier","both"]),optional(p.tax,30),optional(p.phone,50),optional(p.email,200),optional(p.address)]),
    updateParty:()=>{const id=exists("parties",p.id);db.run("UPDATE parties SET name=?,kind=?,tax_id=?,phone=?,email=?,address=? WHERE id=?",[required(p.name,"Cari adı"),one(p.kind,["customer","supplier","both"]),optional(p.tax,30),optional(p.phone,50),optional(p.email,200),optional(p.address),id]);return id;},
    addProduct:()=>run("INSERT INTO products(code,barcode,name,unit,purchase_cents,sale_cents) VALUES(?,?,?,?,?,?)",[required(p.code,"Ürün kodu",90),optional(p.barcode,100)||null,required(p.name,"Ürün adı"),required(p.unit||"Adet","Birim",30),cents(p.purchase,true),cents(p.sale,true)]),
    updateProduct:()=>{const id=exists("products",p.id);db.run("UPDATE products SET code=?,barcode=?,name=?,unit=?,purchase_cents=?,sale_cents=? WHERE id=?",[required(p.code,"Ürün kodu",90),optional(p.barcode,100)||null,required(p.name,"Ürün adı"),required(p.unit||"Adet","Birim",30),cents(p.purchase,true),cents(p.sale,true),id]);return id;},
    adjustStock:()=>{const id=exists("products",p.id),amount=milli(p.qty),sign=one(p.direction,["increase","decrease"])==="increase"?1:-1;db.run("UPDATE products SET stock_milli=stock_milli+? WHERE id=? AND stock_milli+?>=0",[amount*sign,id,amount*sign]);if(db.getRowsModified()!==1)throw Error("Stok negatife düşemez");run("INSERT INTO stock_movements(product_id,delta_milli,reason,ref_type,note) VALUES(?,?,?,?,?)",[id,amount*sign,"sayım/düzeltme","manual",optional(p.notes)]);return true;},
    addInvoice:()=>saveInvoice(p),
    addBank:()=>run("INSERT INTO banks(name,iban) VALUES(?,?)",[required(p.name,"Banka adı"),optional(p.iban,40)]),
    bankMovement:()=>{const bankId=exists("banks",p.bankId),amount=cents(p.amount)*(one(p.direction,["in","out"])==="in"?1:-1);return run("INSERT INTO bank_movements(bank_id,amount_cents,description,ref_type) VALUES(?,?,?,'manual')",[bankId,amount,required(p.notes,"İşlem açıklaması",500)]);},
    cashMovement:()=>{const amount=cents(p.amount)*(one(p.direction,["in","out"])==="in"?1:-1);return run("INSERT INTO cash_movements(amount_cents,description,ref_type) VALUES(?,?,'manual')",[amount,required(p.notes,"İşlem açıklaması",500)]);},
    addPayment:()=>payment(p),
    addInstrument:()=>run("INSERT INTO instruments(party_id,kind,direction,number,amount_cents,due_date,status,bank_name,description) VALUES(?,?,?,?,?,?,'pending',?,?)",[exists("parties",p.partyId),one(p.kind,["cheque","note"]),one(p.direction,["received","issued"]),required(p.number,"Evrak numarası",100),cents(p.amount),date(p.dueDate),optional(p.bankName,200),optional(p.notes)]),
    instrumentStatus:()=>{const id=exists("instruments",p.id),status=one(p.status,["collected","bounced","cancelled"]);db.run("UPDATE instruments SET status=? WHERE id=? AND status='pending'",[status,id]);if(db.getRowsModified()!==1)throw Error("Evrak zaten sonuçlandırılmış");return true;},
    addOrder:()=>createOrder(p),
    orderStatus:()=>{const id=exists("orders",p.id),status=one(p.status,["completed","cancelled"]);db.run("UPDATE orders SET status=? WHERE id=? AND status='open'",[status,id]);if(db.getRowsModified()!==1)throw Error("Sipariş zaten kapatılmış");return true;}
  };
  if(!Object.hasOwn(actions,command))throw Error("Tanımsız işlem");
  try{return transaction(actions[command]);}catch(e){if(String(e.message).includes("UNIQUE constraint"))throw Error("Bu kod veya evrak numarası zaten kayıtlı");throw e;}
}
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt=c=>(Number(c)/100).toLocaleString("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2})+" TL";
function invoiceHTML(id){
  const i=invoiceDetails(id), settings=Object.fromEntries(rows("SELECT key,value FROM settings").map(x=>[x.key,x.value]));
  const kinds={sale:"SATIŞ",purchase:"ALIŞ",sale_return:"SATIŞ İADESİ",purchase_return:"ALIŞ İADESİ"};
  const body=i.lines.map((l,n)=>`<tr><td>${n+1}</td><td>${esc(l.product_name)}<small>${esc(l.code)}</small></td><td>${(l.qty_milli/1000).toLocaleString("tr-TR")} ${esc(l.unit)}</td><td>${fmt(l.price_cents)}</td><td>%${l.vat_rate}</td><td>${fmt(l.total_cents)}</td></tr>`).join("");
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>${esc(i.number)} - Çalışkan Dükkan</title><style>body{font:14px Arial;padding:36px;color:#111827}header{display:flex;justify-content:space-between;border-bottom:3px solid #172c4d;padding-bottom:24px}h1{font-size:23px;margin:0}small{display:block;color:#64748b;margin-top:4px}.muted{color:#64748b}table{border-collapse:collapse;width:100%;margin:30px 0}th,td{padding:12px 8px;border-bottom:1px solid #e2e8f0;text-align:left}th{background:#f1f5f9}.sum{text-align:right;font-weight:bold;font-size:18px}footer{margin-top:70px;border-top:1px solid #ddd;padding-top:10px;color:#64748b;font-size:11px}@media print{button{display:none}body{padding:12px}}</style></head><body><button onclick="window.print()">Yazdır / PDF kaydet</button><header><div><h1>${esc(settings.company||"İşletmem")}</h1><p class="muted">${esc(settings.address||"")}<br>${esc(settings.phone||"")} · ${esc(settings.tax||"")}</p></div><div><h2>${kinds[i.kind]}</h2><p>No: <b>${esc(i.number)}</b><br>Tarih: ${esc(i.date)}</p></div></header><h3>Cari: ${esc(i.party_name)}</h3><p class="muted">${esc(i.party_address||"")} · ${esc(i.tax_id||"")}</p><table><thead><tr><th>#</th><th>Ürün</th><th>Miktar</th><th>Birim Fiyat</th><th>KDV</th><th>Toplam</th></tr></thead><tbody>${body}</tbody></table><div class="sum">Ara Toplam: ${fmt(i.net_cents)}<br>KDV: ${fmt(i.vat_cents)}<br>GENEL TOPLAM: ${fmt(i.total_cents)}</div><p>${esc(i.notes)}</p><footer>Çalışkan Dükkan dahili muhasebe çıktısıdır. Resmî GİB e-Fatura / e-Arşiv belgesi değildir.</footer></body></html>`;
}
module.exports={initialize,execute,backup,restore,invoiceHTML};
