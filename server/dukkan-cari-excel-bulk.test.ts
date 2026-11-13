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
test("preview matches existing cari by code and adds to ledger balance",async()=>{
  const store=1;
  const db:any={
    query:async(sql:string,params:any[])=>{
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
  assert.equal(result.created,1);
  assert.equal(result.conflicts,0);
  assert.equal(result.rows[0].oldCents,14000);
  assert.equal(result.rows[0].cents,125050);
  assert.equal(result.rows[0].afterCents,139050);
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
    if(sql.includes("FROM dukkan_parties"))return {rows:[]};
    if(sql.includes("FROM dukkan_cari_excel_batches"))return {rows:[],rowCount:0};
    throw Error("Unexpected query");
  }};
  const p=await previewCariExcel(db,1,input);
  assert.equal(p.conflicts,1);
});

test("company name conflicting with a coded cari requires manual review",async()=>{
  const fixtureBytes=fixture();
  const db:any={query:async(sql:string)=>{
    if(sql.includes("FROM dukkan_parties"))return {rows:[{
      id:"7",name:"BAŞKA FİRMA",source_cari_no:"C-101",account_code:"A100",
      tax_number:"1234567890",balance:"50.00"
    }]};
    if(sql.includes("FROM dukkan_cari_excel_batches"))return {rows:[],rowCount:0};
    throw Error("Unexpected SQL");
  }};
  const p=await previewCariExcel(db,1,fixtureBytes);
  assert.equal(p.conflicts,1);
  assert.equal(p.rows[0].match,"conflict");
});
