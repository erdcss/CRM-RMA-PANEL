import { inflateRawSync } from "node:zlib";

/** Small bounded reader for ordinary Office Open XML spreadsheets.
 * Extracts plain cell values only; formulas use their cached values.
 * No macros, external links or embedded objects are evaluated.
 */
const MAX_SHEET_BYTES = 24_000_000;
const MAX_ROWS = 5000;

function fail(message:string):never { throw Object.assign(new Error(message),{status:422}); }
function xmlText(v:string):string {
  return v.replace(/&#(x[0-9a-f]+|\d+);|&(amp|lt|gt|quot|apos);/gi,(_,num:string,name:string)=>{
    if(name)return ({amp:"&",lt:"<",gt:">",quot:'"',apos:"'"} as Record<string,string>)[name.toLowerCase()]||"";
    const cp=num.toLowerCase().startsWith("x")?parseInt(num.slice(1),16):parseInt(num,10);
    return cp>0&&cp<=0x10ffff?String.fromCodePoint(cp):"";
  });
}
function tagAttr(source:string,key:string):string {
  return xmlText(new RegExp("(?:^|\\s)"+key.replace(":","\\:")+"=[\"']([^\"']*)[\"']","i").exec(source)?.[1]||"");
}
function unzipSelected(buffer:Buffer):Map<string,string> {
  if(buffer.length<22||buffer.readUInt32LE(0)!==0x04034b50)fail("Excel dosyasının ZIP içeriği okunamıyor.");
  const lower=Math.max(0,buffer.length-65557);
  let eocd=-1;
  for(let i=buffer.length-22;i>=lower;i--){if(buffer.readUInt32LE(i)===0x06054b50){eocd=i;break;}}
  if(eocd<0)fail("Excel dosyası eksik veya bozuk.");
  const count=buffer.readUInt16LE(eocd+10);
  const centralSize=buffer.readUInt32LE(eocd+12),offset=buffer.readUInt32LE(eocd+16);
  if(count>1500||offset+centralSize>buffer.length)fail("Excel dosyası beklenen sınırları aşıyor.");
  const files=new Map<string,string>();
  let p=offset,total=0;
  for(let i=0;i<count;i++){
    if(p+46>buffer.length||buffer.readUInt32LE(p)!==0x02014b50)fail("Excel dosyası bozuk.");
    const method=buffer.readUInt16LE(p+10),compressed=buffer.readUInt32LE(p+20);
    const inflated=buffer.readUInt32LE(p+24);
    const nameLength=buffer.readUInt16LE(p+28),extra=buffer.readUInt16LE(p+30),comment=buffer.readUInt16LE(p+32);
    const localOffset=buffer.readUInt32LE(p+42);
    const name=buffer.subarray(p+46,p+46+nameLength).toString("utf8").replace(/^\/+/,"");
    p+=46+nameLength+extra+comment;
    if(!(/^(?:xl\/workbook\.xml|xl\/_rels\/workbook\.xml\.rels|xl\/sharedStrings\.xml|xl\/worksheets\/sheet\d+\.xml)$/.test(name)))continue;
    if(inflated>MAX_SHEET_BYTES||compressed>buffer.length||total+inflated>MAX_SHEET_BYTES*2)fail("Excel dosyası çok büyük.");
    if(localOffset+30>buffer.length||buffer.readUInt32LE(localOffset)!==0x04034b50)fail("Bozuk Excel hücre verisi.");
    const start=localOffset+30+buffer.readUInt16LE(localOffset+26)+buffer.readUInt16LE(localOffset+28);
    if(start+compressed>buffer.length)fail("Excel çalışma sayfası eksik.");
    const bytes=buffer.subarray(start,start+compressed);
    let data:Buffer;
    try {data=method===0?bytes:method===8?inflateRawSync(bytes,{maxOutputLength:MAX_SHEET_BYTES}):fail("Excel sıkıştırma biçimi desteklenmiyor.");}
    catch {fail("Excel çalışma sayfası açılamadı.");}
    if(data.length!==inflated)fail("Excel dosyası hatalı veya eksik.");
    files.set(name,data.toString("utf8"));
    total+=inflated;
  }
  return files;
}
function extractStrings(xml:string):string[] {
  const strings:string[]=[];
  for(const m of xml.matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)){
    const content=m[1].replace(/<rPh\b[\s\S]*?<\/rPh>/g,"");
    strings.push([...content.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(v=>xmlText(v[1])).join(""));
  }
  return strings;
}
function firstSheet(files:Map<string,string>):string {
  const book=files.get("xl/workbook.xml")||"";
  const rels=files.get("xl/_rels/workbook.xml.rels")||"";
  const sheet=/<sheet\b([^>]*?)\/?>/i.exec(book);
  const rid=sheet?tagAttr(sheet[1],"r:id"):"";
  if(rid){
    for(const m of rels.matchAll(/<Relationship\b([^>]*?)\/?>/g)){
      if(tagAttr(m[1],"Id")!==rid)continue;
      const path=tagAttr(m[1],"Target").replace(/^\/+/,"");
      const target=path.startsWith("xl/")?path:"xl/"+path;
      if(files.has(target))return files.get(target)!;
    }
  }
  const fallback=[...files.keys()].filter(x=>/^xl\/worksheets\/sheet\d+\.xml$/.test(x)).sort((a,b)=>{
    const x=Number(/\d+/.exec(a)?.[0]||0),y=Number(/\d+/.exec(b)?.[0]||0);
    return x-y;
  })[0];
  if(!fallback)fail("Excel çalışma sayfası bulunamadı.");
  return files.get(fallback)!;
}
function columnIndex(ref:string):number {
  const m=/^[A-Z]+/i.exec(ref);
  if(!m)return -1;
  let n=0;for(const char of m[0].toUpperCase())n=n*26+char.charCodeAt(0)-64;
  return n-1;
}
export function parseXlsxRows(input:Buffer):string[][] {
  const files=unzipSelected(input);
  const shared=extractStrings(files.get("xl/sharedStrings.xml")||"");
  const sheet=firstSheet(files);
  const rows:string[][]=[];
  for(const row of sheet.matchAll(/<row\b([^>]*?)>([\s\S]*?)<\/row>/g)){
    const physical=Number(tagAttr(row[1],"r"))||rows.length+1;
    if(physical>MAX_ROWS||physical<rows.length+1)fail("Excel satır sayısı beklenen sınırları aşıyor.");
    while(rows.length<physical-1)rows.push([]);
    const values:string[]=[];
    for(const cell of row[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)){
      const col=columnIndex(tagAttr(cell[1],"r"));
      if(col<0||col>100)continue;
      const kind=tagAttr(cell[1],"t");
      const content=cell[2]||"";
      let value="";
      if(kind==="inlineStr")value=[...content.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(m=>xmlText(m[1])).join("");
      else {
        const raw=/<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/.exec(content)?.[1]||"";
        value=kind==="s"?shared[Number(raw)]||"":xmlText(raw);
      }
      values[col]=String(value).trim().slice(0,500);
    }
    rows.push(values);
  }
  if(!rows.length)fail("Excel dosyasında okunabilir satır bulunamadı.");
  return rows;
}
export function isXlsx(input:Buffer):boolean {
  return input.length>=4&&input.readUInt32LE(0)===0x04034b50;
}
