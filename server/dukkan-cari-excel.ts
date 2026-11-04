import { deflateRawSync } from "node:zlib";

type CariExcelRow = {
  source_cari_no: string | null;
  account_code: string | null;
  name: string;
  city: string | null;
  phone: string | null;
  type: "customer" | "supplier" | "both";
  tax_number: string | null;
  email: string | null;
  special_code: string | null;
  balance: string | number;
};

const esc = (value: unknown) => String(value ?? "")
  .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;")
  .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
  .replace(/'/g, "&apos;");

const stringCell = (column: string, row: number, value: unknown, style = 0) =>
  `<c r="${column}${row}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${esc(value)}</t></is></c>`;
const numberCell = (column: string, row: number, value: number, style = 2) =>
  `<c r="${column}${row}" s="${style}" t="n"><v>${Number.isFinite(value) ? value.toFixed(2) : "0.00"}</v></c>`;

const columns = ["A","B","C","D","E","F","G","H","I","J"];
const headers = ["Cari No", "Hesap Kodu", "Cari Adı", "İl", "Telefon", "Cari Tipi", "Vergi No", "E-posta", "Özel Kod", "Bakiye (TL)"];
const widths = [16,20,43,18,20,23,18,33,20,21];
const labels: Record<CariExcelRow["type"], string> = {
  customer:"Müşteri",supplier:"Tedarikçi",both:"Müşteri / Tedarikçi",
};

// ZIP container for an actual Office OpenXML .xlsx file, without a third-party runtime dependency.
const crcTable = new Uint32Array(256);
for (let n=0;n<256;n++) {
  let c=n;
  for(let k=0;k<8;k++)c=(c & 1)?(0xedb88320 ^ (c>>>1)):(c>>>1);
  crcTable[n]=c>>>0;
}
function crc32(buffer: Buffer) {
  let c=0xffffffff;
  for (const byte of buffer)c=crcTable[(c^byte)&255]^(c>>>8);
  return (c^0xffffffff)>>>0;
}
function zipFiles(files: Array<{name:string, content:string}>): Buffer {
  let offset=0;
  const entries: Buffer[]=[];
  const directory: Buffer[]=[];
  for(const file of files) {
    const filename=Buffer.from(file.name,"utf8");
    const raw=Buffer.from(file.content,"utf8");
    const compressed=deflateRawSync(raw);
    const crc=crc32(raw);
    const local=Buffer.alloc(30+filename.length);
    local.writeUInt32LE(0x04034b50,0);
    local.writeUInt16LE(20,4);
    local.writeUInt16LE(0,6);
    local.writeUInt16LE(8,8);
    local.writeUInt32LE(crc,14);
    local.writeUInt32LE(compressed.length,18);
    local.writeUInt32LE(raw.length,22);
    local.writeUInt16LE(filename.length,26);
    filename.copy(local,30);
    entries.push(local,compressed);

    const central=Buffer.alloc(46+filename.length);
    central.writeUInt32LE(0x02014b50,0);
    central.writeUInt16LE(20,4);
    central.writeUInt16LE(20,6);
    central.writeUInt16LE(8,10);
    central.writeUInt32LE(crc,16);
    central.writeUInt32LE(compressed.length,20);
    central.writeUInt32LE(raw.length,24);
    central.writeUInt16LE(filename.length,28);
    central.writeUInt32LE(offset,42);
    filename.copy(central,46);
    directory.push(central);
    offset+=local.length+compressed.length;
  }
  const directorySize=directory.reduce((sum,entry)=>sum+entry.length,0);
  const end=Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50,0);
  end.writeUInt16LE(files.length,8);
  end.writeUInt16LE(files.length,10);
  end.writeUInt32LE(directorySize,12);
  end.writeUInt32LE(offset,16);
  return Buffer.concat([...entries,...directory,end]);
}

export function buildCariExcel(
  kind: "debt" | "credit",
  storeName: string,
  items: CariExcelRow[],
): Buffer {
  const kindName=kind==="debt"?"Borçlu Cariler":"Alacaklı Cariler";
  const values=items.map(item=>{
    const signed=Number(item.balance);
    // A credit is exported as a positive amount in the Alacaklı report.
    return kind==="credit"?-signed:signed;
  });
  const totalCents=values.reduce((sum,value)=>sum+Math.round(value*100),0);
  const generatedAt=new Date().toISOString().slice(0,10);
  const rows: string[]=[
    `<row r="1" ht="31" customHeight="1">${stringCell("A",1,"ÇALIŞKAN DÜKKAN · "+kindName,1)}</row>`,
    `<row r="2">${stringCell("A",2,"Mağaza: "+storeName)}${stringCell("D",2,"Rapor tarihi: "+generatedAt)}</row>`,
    `<row r="3">${stringCell("A",3,"Cari sayısı")}${numberCell("B",3,items.length,0)}${stringCell("H",3,"Toplam bakiye")}${numberCell("J",3,totalCents/100,2)}</row>`,
  ];
  rows.push(`<row r="5" ht="24" customHeight="1">${headers.map((h,i)=>stringCell(columns[i],5,h,1)).join("")}</row>`);
  for(let i=0;i<items.length;i++){
    const item=items[i],r=i+6;
    const data=[item.source_cari_no,item.account_code,item.name,item.city,item.phone,labels[item.type]||item.type,item.tax_number,item.email,item.special_code];
    rows.push(`<row r="${r}">${data.map((value,j)=>stringCell(columns[j],r,value)).join("")}${numberCell("J",r,values[i])}</row>`);
  }
  const totalRow=items.length+6;
  rows.push(`<row r="${totalRow}" ht="23" customHeight="1">${stringCell("I",totalRow,"GENEL TOPLAM",1)}${numberCell("J",totalRow,totalCents/100,3)}</row>`);

  const sheet=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:J${totalRow}"/>
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="5" topLeftCell="A6" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="19"/>
  <cols>${widths.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join("")}</cols>
  <sheetData>${rows.join("")}</sheetData>
  <mergeCells count="1"><mergeCell ref="A1:J1"/></mergeCells>
  <autoFilter ref="A5:J${Math.max(5,totalRow-1)}"/>
</worksheet>`;

  const styles=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
 <numFmts count="0"/>
 <fonts count="2"><font><sz val="11"/><name val="Aptos"/></font><font><b/><sz val="11"/><color rgb="FF16283C"/><name val="Aptos"/></font></fonts>
 <fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFCB28"/><bgColor indexed="64"/></patternFill></fill></fills>
 <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
 <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
 <cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="4" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyNumberFormat="1"/></cellXfs>
 <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

  const files=[
    {name:"[Content_Types].xml",content:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`},
    {name:"_rels/.rels",content:`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`},
    {name:"xl/workbook.xml",content:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${esc(kindName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`},
    {name:"xl/_rels/workbook.xml.rels",content:`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`},
    {name:"xl/worksheets/sheet1.xml",content:sheet},
    {name:"xl/styles.xml",content:styles},
  ];
  return zipFiles(files);
}
