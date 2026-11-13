import test from "node:test";
import assert from "node:assert/strict";
import {buildCariExcel} from "./dukkan-cari-excel";
import {parseXlsxRows} from "./dukkan-xlsx-reader";
import {parseCariExcelRows,previewCariExcel} from "./dukkan-cari-excel-bulk";

function fixture() {
  return buildCariExcel("debt","Çalışkan Test",[
    {source_cari_no:"C-101",account_code:"A100",name:"MEHMET TEKSTİL",city:"İstanbul",
      phone:"0212 222 22 22",type:"customer",tax_number:"1234567890",email:null,special_code:null,balance:"1250.50"},
    {source_cari_no:"C-102",account_code:"A200",name:"AHMET LTD",city:null,
      phone:null,type:"supplier",tax_number:null,email:null,special_code:null,balance:"800.00"},
  ]);
}
test("real exported XLSX reads column headers and exact money",()=>{
  const rows=parseXlsxRows(fixture());
  assert.ok(rows.some(row=>row[2]==="Cari Adı"));
  const data=parseCariExcelRows(fixture());
  assert.equal(data.length,2);
  assert.deepEqual(data.map(x=>[x.name,x.sourceCariNo,x.cents]),[
    ["MEHMET TEKSTİL","C-101",125050],
    ["AHMET LTD","C-102",80000]
  ]);
});
test("credit Excel uses negative signed balance",()=>{
  const buf=buildCariExcel("credit","Test",[
    {source_cari_no:"A-1",account_code:null,name:"ALACAKLI",city:null,
      phone:null,type:"customer",tax_number:null,email:null,special_code:null,balance:"-200.50"}
  ]);
  assert.equal(parseCariExcelRows(buf)[0].cents,-20050);
});
test("corrupt or fake XLSX is rejected",()=>{
  assert.throws(()=>parseXlsxRows(Buffer.from("PK-not-a-workbook")));
});
test("preview matches existing cari by code and reconciles report target instead of adding it",async()=>{
  const store=1;
  const db:any={
    query:async(sql:string,params:any[])=>{
      if(sql.includes("FROM dukkan_stores"))return {rows:[{name:"Çalışkan Test"}]};
    if(sql.includes("FROM dukkan_parties"))return {rows:[{
        id:"12",name:"MEHMET TEKSTİL",source_cari_no:"C-101",account_code:"A100",
        tax_number:"1234567890",balance:"140.00"
      }]};
      if(sql.includes("FROM dukkan_cari_excel_batches"))return {rows:[],rowCount:0};
      throw Error("Unexpected query: "+sql);
    }
  };
  const result=await previewCariExcel(db,store,fixture());
  assert.equal(result.duplicate,false);
  assert.equal(result.existing,1);
  assert.equal(result.created,0);
  assert.equal(result.conflicts,1);
  assert.equal(result.rows[0].oldCents,14000);
  assert.equal(result.rows[0].cents,125050);
  assert.equal(result.rows[0].afterCents,125050);
  assert.equal(result.rows[0].postingCents,111050);
  assert.equal(result.sourceKind,"report_snapshot");
  assert.equal(result.rows[0].partyId,"12");
});
test("same source cari repeated in source is blocked before posting",async()=>{
  const input=buildCariExcel("debt","Test",[
    {source_cari_no:"A1",account_code:null,name:"FİRMA A",city:null,phone:null,
      type:"customer",tax_number:null,email:null,special_code:null,balance:"10"},
    {source_cari_no:"A1",account_code:null,name:"FİRMA A",city:null,phone:null,
      type:"customer",tax_number:null,email:null,special_code:null,balance:"20"},
  ]);
  const db:any={query:async(sql:string)=>{
    if(sql.includes("FROM dukkan_stores"))return {rows:[{name:"Test"}]};
    if(sql.includes("FROM dukkan_parties"))return {rows:[]};
    if(sql.includes("FROM dukkan_cari_excel_batches"))return {rows:[],rowCount:0};
    throw Error("Unexpected query");
  }};
  const p=await previewCariExcel(db,1,input);
  assert.equal(p.conflicts,2);
});

test("company name conflicting with a coded cari requires manual review",async()=>{
  const fixtureBytes=fixture();
  const db:any={query:async(sql:string)=>{
    if(sql.includes("FROM dukkan_stores"))return {rows:[{name:"Çalışkan Test"}]};
    if(sql.includes("FROM dukkan_parties"))return {rows:[{
      id:"7",name:"BAŞKA FİRMA",source_cari_no:"C-101",account_code:"A100",
      tax_number:"1234567890",balance:"50.00"
    }]};
    if(sql.includes("FROM dukkan_cari_excel_batches"))return {rows:[],rowCount:0};
    throw Error("Unexpected SQL");
  }};
  const p=await previewCariExcel(db,1,fixtureBytes);
  assert.equal(p.conflicts,2);
  assert.equal(p.rows[0].match,"conflict");
});

test("different cari numbers with same displayed company name are not false duplicate rows",async()=>{
  const input=buildCariExcel("debt","Test",[
    {source_cari_no:"0001",account_code:null,name:"FİRMA A",city:null,phone:null,
      type:"customer",tax_number:null,email:null,special_code:null,balance:"10"},
    {source_cari_no:"0002",account_code:null,name:"FİRMA A",city:null,phone:null,
      type:"customer",tax_number:null,email:null,special_code:null,balance:"20"},
  ]);
  const db:any={query:async(sql:string)=>{
    if(sql.includes("FROM dukkan_stores"))return {rows:[{name:"Test"}]};
    if(sql.includes("FROM dukkan_parties"))return {rows:[]};
    if(sql.includes("FROM dukkan_cari_excel_batches"))return {rows:[],rowCount:0};
    throw Error("Unexpected query");
  }};
  const result=await previewCariExcel(db,1,input);
  assert.equal(result.conflicts,2);
  assert.equal(result.created,0);
  assert.ok(result.rows.every(r=>r.issue?.includes("bulunamadı")));
  assert.ok(result.rows.every(r=>!r.issue?.includes("mükerrer")));
});
test("single-name match with a changed cari code requires explicit review",async()=>{
  const db:any={query:async(sql:string)=>{
    if(sql.includes("FROM dukkan_stores"))return {rows:[{name:"Çalışkan Test"}]};
    if(sql.includes("FROM dukkan_parties"))return {rows:[{
      id:"7",name:"MEHMET TEKSTİL",source_cari_no:"OLD",account_code:"A100",
      tax_number:"1234567890",balance:"50.00"
    }]};
    if(sql.includes("FROM dukkan_cari_excel_batches"))return {rows:[],rowCount:0};
    throw Error("Unexpected SQL");
  }};
  const first=await previewCariExcel(db,1,fixture());
  assert.equal(first.conflicts,2);
  assert.equal(first.rows[0].candidates[0].id,"7");
  const fixed=await previewCariExcel(db,1,fixture(),{"6":"party:7","7":"skip"});
  assert.equal(fixed.conflicts,0);
  assert.equal(fixed.rows[0].match,"existing");
  assert.equal(fixed.rows[0].afterCents,125050);
  const wrong=await previewCariExcel(db,1,fixture(),{"6":"party:999","7":"skip"});
  assert.equal(wrong.conflicts,1);
});
test("duplicate Excel row can be explicitly skipped but not applied twice",async()=>{
  const input=buildCariExcel("debt","Test",[
    {source_cari_no:"A1",account_code:null,name:"FİRMA A",city:null,phone:null,
      type:"customer",tax_number:null,email:null,special_code:null,balance:"10"},
    {source_cari_no:"A1",account_code:null,name:"FİRMA A",city:null,phone:null,
      type:"customer",tax_number:null,email:null,special_code:null,balance:"20"},
  ]);
  const db:any={query:async(sql:string)=>{
    if(sql.includes("FROM dukkan_stores"))return {rows:[{name:"Test"}]};
    if(sql.includes("FROM dukkan_parties"))return {rows:[{id:"1",name:"FİRMA A",source_cari_no:"A1",account_code:null,tax_number:null,balance:"0.00"}]};
    if(sql.includes("FROM dukkan_cari_excel_batches"))return {rows:[],rowCount:0};
    throw Error("Unexpected SQL");
  }};
  const fixed=await previewCariExcel(db,1,input,{"7":"skip"});
  assert.equal(fixed.conflicts,0);
  assert.equal(fixed.created,0);
  assert.equal(fixed.skipped,1);
  assert.equal(fixed.rows[1].match,"skipped");
  assert.equal(fixed.rows[1].afterCents,fixed.rows[1].oldCents);
  const notFixed=await previewCariExcel(db,1,input,{"7":"party:11"});
  assert.equal(notFixed.conflicts,1);
});

test("136-row generated Borçlu Cariler report is idempotent and preserves account identities",async()=>{
  const fixtureRows=Array.from({length:136},(_,i)=>({
    source_cari_no:String(375+i),account_code:"C"+String(i+1).padStart(6,"0"),
    name:i<2?"AYNI İSİMLİ FİRMA":"CARİ "+String(i+1),city:null,phone:null,
    type:"both" as const,tax_number:null,email:null,special_code:null,
    balance:i===0?"1928100.00":i===1?"921010.00":"1250.00",
  }));
  const bytes=buildCariExcel("debt","ÇALIŞKAN GROUP",fixtureRows);
  const existing=fixtureRows.map((p,i)=>({
    id:String(i+1),name:p.name,source_cari_no:p.source_cari_no,
    account_code:p.account_code,tax_number:null,balance:p.balance
  }));
  const db:any={query:async(sql:string)=>{
    if(sql.includes("FROM dukkan_stores"))return {rows:[{name:"ÇALIŞKAN GROUP"}]};
    if(sql.includes("FROM dukkan_parties"))return {rows:existing};
    if(sql.includes("FROM dukkan_cari_excel_batches"))return {rows:[],rowCount:0};
    throw Error("Unexpected query "+sql);
  }};
  const result=await previewCariExcel(db,1,bytes);
  assert.equal(result.rows.length,136);
  assert.equal(result.sourceKind,"report_snapshot");
  assert.equal(result.conflicts,0);
  assert.equal(result.unchanged,136);
  assert.equal(result.changed,0);
  assert.equal(result.totalAdjustmentCents,0);
  assert.equal(result.existing,136);
  assert.equal(result.rows[0].oldCents,192810000);
  assert.equal(result.rows[0].postingCents,0);
  assert.equal(result.rows[1].oldCents,92101000);
  assert.equal(result.rows[1].partyId,"2");
});
test("report reconciles only a modified target balance and not the entire old balance again",async()=>{
  const rows=[{source_cari_no:"375",account_code:"C000086",name:"ÖMER BAYRAKTAR - LORENZO",city:null,
    phone:null,type:"both" as const,tax_number:null,email:null,special_code:null,balance:"1928100.00"}];
  const bytes=buildCariExcel("debt","ÇALIŞKAN GROUP",rows);
  const db:any={query:async(sql:string)=>{
    if(sql.includes("FROM dukkan_stores"))return {rows:[{name:"ÇALIŞKAN GROUP"}]};
    if(sql.includes("FROM dukkan_parties"))return {rows:[{
      id:"1",name:rows[0].name,source_cari_no:"375",account_code:"C000086",tax_number:null,balance:"1925100.00"
    }]};
    if(sql.includes("FROM dukkan_cari_excel_batches"))return {rows:[],rowCount:0};
    throw Error("Unexpected query "+sql);
  }};
  const p=await previewCariExcel(db,1,bytes);
  assert.equal(p.conflicts,0);
  assert.equal(p.changed,1);
  assert.equal(p.rows[0].postingCents,300000);
  assert.equal(p.rows[0].afterCents,192810000);
});
test("a generated report cannot reconcile a different store even with matching cari numbers",async()=>{
  const db:any={query:async(sql:string)=>{
    if(sql.includes("FROM dukkan_stores"))return {rows:[{name:"BAŞKA MAĞAZA"}]};
    if(sql.includes("FROM dukkan_parties"))return {rows:[]};
    if(sql.includes("FROM dukkan_cari_excel_batches"))return {rows:[],rowCount:0};
    throw Error("Unexpected query "+sql);
  }};
  await assert.rejects(previewCariExcel(db,1,fixture()),/başka bir mağazaya aittir/);
});
