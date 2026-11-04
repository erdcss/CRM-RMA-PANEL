import test from "node:test";
import assert from "node:assert/strict";
import {parsePositionedCariStatement,trMoney} from "./dukkan-cari-statement-parser";

// Representative artificial coordinates: two A4 pages, one invoice continuing
// across the page break. No real customer financial data in this test fixture.
const w=(x:number,y:number,value:string)=>({x,y,value});
test("parse all dated movements and invoice rows across multiple PDF pages",()=>{
  const page1=[
    w(114,50,"ÖRNEK FİRMA"),w(540,50,"04.11.2026"),
    w(114,72,"000000045"),w(468,72,"01.01.2025"),w(527,72,"31.12.2026"),
    w(114,87,"ÖRNEK MÜŞTERİ"),w(114,104,"TL"),
    w(33,160,"01.01.2025"),w(90,160,"01.01.2025"),w(147,160,"Açılış Kartı"),
      w(217,160,"00001"),w(273,160,"Devreden bakiye"),
      w(440,160,"100,00"),w(499,160,"0,00"),w(530,160,"100,00"),w(570,160,"[B]"),
    w(33,174,"02.01.2025"),w(90,174,"03.01.2025"),w(147,174,"Satış Faturası"),
      w(217,174,"00002"),w(440,174,"300,00"),w(499,174,"0,00"),
      w(530,174,"400,00"),w(570,174,"[B]"),
    w(87,188,"Ürün A"),w(255,188,"2"),w(273,188,"Adet"),
      w(320,188,"100,00"),w(391,188,"100,00"),w(440,188,"200,00"),
  ];
  const page2=[
    w(114,50,"ÖRNEK FİRMA"),w(540,50,"04.11.2026"),
    w(114,72,"000000045"),w(114,87,"ÖRNEK MÜŞTERİ"),w(114,104,"TL"),
    w(87,160,"Ürün B"),w(255,160,"1"),w(273,160,"Adet"),
      w(320,160,"100,00"),w(391,160,"100,00"),w(440,160,"100,00"),
    w(33,175,"03.01.2025"),w(90,175,"03.01.2025"),w(147,175,"Tahsil"),
      w(217,175,"00003"),w(273,175,"HESABA HAVALE"),w(440,175,"0,00"),
      w(480,175,"150,00"),w(530,175,"250,00"),w(570,175,"[B]"),
  ];
  const doc=parsePositionedCariStatement([page1,page2]);
  assert.equal(doc.party.sourceCariNo,"000000045");
  assert.equal(doc.party.name,"ÖRNEK MÜŞTERİ");
  assert.equal(doc.entries.length,3);
  assert.equal(doc.entries[1].kind,"sale");
  assert.equal(doc.entries[1].date,"2025-01-02");
  assert.equal(doc.entries[1].dueDate,"2025-01-03");
  assert.deepEqual(doc.entries[1].lines.map(x=>x.productName),["Ürün A","Ürün B"]);
  assert.equal(doc.entries[2].credit,150);
  assert.equal(doc.declaredClosingBalance,250);
});
test("Turkish thousand separators and exact balance sum",()=>{
  assert.equal(trMoney("9.537,00"),9537);
  assert.equal(trMoney("100.000,0"),100000);
  assert.equal(trMoney("1.650,00 TL"),1650);
  assert.equal(trMoney("0,00"),0);
});
