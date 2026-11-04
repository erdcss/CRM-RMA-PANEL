import assert from "node:assert/strict";
import test from "node:test";
import {jsPDF} from "jspdf";
import {extractPositionedPdfWords,parsePositionedCariStatement} from "./dukkan-cari-statement-parser";

test("actual two-page PDF text coordinates preserve invoice continuation and amounts",async()=>{
  const pdf=new jsPDF({unit:"pt",format:"a4",compress:true});
  const text=(x:number,y:number,content:string)=>pdf.text(content,x,y);
  const header=()=>{
    text(114,50,"ACME TEST LTD");text(538,50,"04.11.2026");
    text(114,72,"0000065");text(468,72,"01.01.2025");text(527,72,"31.12.2026");
    text(114,87,"ORNEK MUSTERI");text(114,104,"TL");
  };
  const row=(y:number,date:string,due:string,kind:string,doc:string,debit:string,credit:string,balance:string)=>{
    text(33,y,date);text(90,y,due);text(147,y,kind);text(217,y,doc);
    text(440,y,debit);text(479,y,credit);text(528,y,balance);text(570,y,"[B]");
  };
  const product=(y:number,name:string,qty:string,price:string,total:string)=>{
    text(87,y,name);text(254,y,qty);text(273,y,"ADET");
    text(317,y,price);text(391,y,price);text(441,y,total);
  };
  header();
  row(160,"01.01.2025","01.01.2025","Acilis Karti","00001","100,00","0,00","100,00");
  row(174,"02.01.2025","03.01.2025","Satis Faturasi","00002","300,00","0,00","400,00");
  product(188,"Kettle Test", "2","100,00","200,00");
  pdf.addPage();
  header();
  product(160,"Kahve Test","1","100,00","100,00");
  row(175,"03.01.2025","03.01.2025","Tahsil","00003","0,00","150,00","250,00");
  const words=await extractPositionedPdfWords(Buffer.from(pdf.output("arraybuffer")));
  const result=parsePositionedCariStatement(words);
  assert.equal(result.pageCount,2);
  assert.equal(result.party.sourceCariNo,"0000065");
  assert.equal(result.entries.length,3);
  assert.equal(result.entries[1].kind,"sale");
  assert.equal(result.entries[1].lines.length,2);
  assert.equal(result.entries[1].lines[0].productName,"Kettle Test");
  assert.equal(result.entries[1].lines[1].productName,"Kahve Test");
  assert.equal(result.declaredClosingBalance,250);
});
