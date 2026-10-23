"use strict";
const $=s=>document.querySelector(s);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money=c=>(Number(c||0)/100).toLocaleString("tr-TR",{style:"currency",currency:"TRY"});
const qty=m=>(Number(m||0)/1000).toLocaleString("tr-TR",{maximumFractionDigits:3});
const labels={sale:"Satış",purchase:"Alış",sale_return:"Satış iadesi",purchase_return:"Alış iadesi",customer:"Müşteri",supplier:"Tedarikçi",both:"Müşteri / Tedarikçi",collection:"Tahsilat",payment:"Ödeme",cash:"Kasa",bank:"Banka",cheque:"Çek",note:"Senet",received:"Alınan",issued:"Verilen",pending:"Bekliyor",collected:"Tahsil edildi",bounced:"Karşılıksız",cancelled:"İptal",open:"Açık",completed:"Tamamlandı",increase:"Giriş",decrease:"Çıkış",in:"Giriş",out:"Çıkış",adjustment:"Sayım",manual:"Manuel"};
const nav=[["dashboard","⌂","Genel Bakış"],["invoices","▤","Satış & Alış Faturaları"],["products","◈","Ürün & Stok Kartları"],["stock","⇄","Stok Hareketleri"],["parties","♧","Cari Hesaplar"],["ledger","≋","Cari Hareketleri"],["orders","▦","Siparişler"],["banks","▣","Banka Hesapları"],["cash","₺","Kasa & Tahsilat"],["checks","▧","Çek & Senetler"],["reports","▥","Raporlar"],["settings","⚙","İşletme & Yedekleme"]];
let tab="dashboard",busy=false,exportRows=[],exportColumns=[],currentForm="",activeEdit={},lineCount=0;
function toast(t,bad=false){const el=$("#toast");el.textContent=t;el.style.background=bad?"#ac4050":"#193b54";el.classList.remove("hidden");clearTimeout(window._toastTimer);window._toastTimer=setTimeout(()=>el.classList.add("hidden"),4300);}
async function call(cmd,p={}){const r=await window.dukkan.call(cmd,p);if(!r.ok)throw Error(r.error||"İşlem başarısız");return r.data;}
async function invoke(cmd,p={}){try{return await call(cmd,p);}catch(e){toast(e.message,true);throw e;}}
function localDate(){const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");}
function navDraw(){$("#nav").innerHTML=nav.map(n=>'<button class="'+(n[0]===tab?"active":"")+'" data-nav="'+n[0]+'"><span class="ico">'+n[1]+'</span>'+n[2]+"</button>").join("");$("#heading").textContent=(nav.find(x=>x[0]===tab)||nav[0])[2];$("#breadcrumb").textContent=$("#heading").textContent;}
function toolbar(actions=[]){return '<div class="section-actions">'+actions.map(a=>'<button class="btn '+(a[2]||"secondary")+'" data-form="'+a[0]+'">'+esc(a[1])+"</button>").join("")+"</div>";}
function hero(k,title,description,actions=[]){return '<div class="hero"><div><div class="kicker">'+esc(k)+'</div><h2>'+esc(title)+'</h2><p>'+esc(description)+'</p></div>'+toolbar(actions)+"</div>";}
function panel(title,subtitle,body){return '<section class="panel"><div class="panel-heading"><div><h3>'+esc(title)+'</h3><div class="sub">'+esc(subtitle||"")+'</div></div></div><div class="table-scroll">'+body+"</div></section>";}
function badge(value){const v=labels[value]||value;const tone=["completed","collected"].includes(value)?"green":["cancelled","bounced"].includes(value)?"red":["pending","open"].includes(value)?"orange":"";return '<span class="badge '+tone+'">'+esc(v)+"</span>";}
function fieldRender(key,value){if(value==null)return "—";if(key==="kind"||key==="status"||key==="direction"||key==="method"||key==="type")return badge(value);if(key==="stock_milli"||key==="qty_milli"||key==="delta_milli")return '<b>'+qty(value)+"</b>";if(key==="amount_cents"||key==="balance"||key==="total_cents"||key==="net_cents"||key==="vat_cents"||key==="purchase_cents"||key==="sale_cents"||key==="value_cents")return '<span class="'+(Number(value)<0?"negative":"")+'">'+money(value)+"</span>";return esc(value);}
function table(rows,columns,opts={}){exportRows=rows;exportColumns=columns;
 if(!rows.length)return '<div class="empty"><div><span class="big">▤</span>Henüz kayıt bulunmuyor.<br>Yeni kayıt oluşturarak başlayabilirsiniz.</div></div>';
 const header='<table><thead><tr>'+columns.map(c=>'<th class="'+(c[2]||"")+'">'+esc(c[1])+"</th>").join("")+(opts.actions?'<th>İşlem</th>':"")+"</tr></thead><tbody>";
 const body=rows.map(row=>'<tr>'+columns.map(c=>'<td class="'+(c[2]||"")+'">'+fieldRender(c[0],row[c[0]])+"</td>").join("")+(opts.actions?'<td>'+opts.actions(row)+"</td>":"")+"</tr>").join("");
 return header+body+"</tbody></table>";
}
function stat(label,value,cls="",detail=""){return '<div class="stat '+cls+'"><div class="stat-title">'+esc(label)+'</div><div class="stat-value">'+esc(value)+'</div><div class="tag">'+esc(detail)+'</div></div>';}
function tableSection(title,subtitle,rows,columns,actions,search=false){return '<section class="panel"><div class="panel-heading"><div><h3>'+esc(title)+'</h3><div class="sub">'+esc(subtitle||"")+'</div></div>'+(search?'<input class="search" id="search-table" placeholder="Tabloda ara..." aria-label="Tabloda ara">':"")+'</div><div class="table-scroll" id="table-host">'+table(rows,columns,{actions})+"</div></section>";}
const columns={
 invoices:[["number","Belge No"],["date","Tarih"],["kind","İşlem"],["party_name","Cari"],["net_cents","Ara Toplam","num"],["vat_cents","KDV","num"],["total_cents","Genel Toplam","num"]],
 products:[["code","Stok Kodu"],["barcode","Barkod"],["name","Ürün"],["unit","Birim"],["stock_milli","Miktar","num"],["purchase_cents","Alış Fiyatı","num"],["sale_cents","Satış Fiyatı","num"]],
 parties:[["name","Cari"],["kind","Tür"],["phone","Telefon"],["tax_id","Vergi No"],["balance","Cari Bakiye","num"]],
 movements:[["created_at","İşlem Tarihi"],["code","Kod"],["product_name","Ürün"],["delta_milli","Miktar","num"],["reason","İşlem Türü"],["note","Açıklama"]],
 ledger:[["created_at","Tarih"],["party_name","Cari"],["amount_cents","Borç / Alacak (+/-)","num"],["description","Açıklama"]],
 orders:[["number","Sipariş No"],["date","Tarih"],["kind","Tür"],["party_name","Cari"],["total_cents","Tutar","num"],["status","Durum"]],
 banks:[["name","Banka"],["iban","IBAN"],["balance","Bakiye","num"]],
 bank_movements:[["created_at","Tarih"],["bank_name","Banka"],["amount_cents","Giriş / Çıkış","num"],["description","Açıklama"]],
 cash_movements:[["created_at","Tarih"],["amount_cents","Giriş / Çıkış","num"],["description","Açıklama"]],
 payments:[["date","Tarih"],["party_name","Cari"],["kind","Tür"],["method","Yöntem"],["amount_cents","Tutar","num"],["description","Açıklama"]],
 instruments:[["number","Evrak No"],["kind","Tür"],["direction","İşlem"],["party_name","Cari"],["amount_cents","Tutar","num"],["due_date","Vade"],["status","Durum"]]
};
async function screen(){
 navDraw();$("#main").innerHTML='<div class="empty">Kayıtlar yükleniyor…</div>';
 try{
 const main=$("#main"), reportTabs=["dashboard","reports"];
 if(tab==="dashboard"){
  const d=await call("dashboard");
  const cards='<div class="cards">'+stat("Net Satış",money(d.sales),"green","Satış eksi satış iadeleri")+stat("Net Alış",money(d.purchases),"","Alış eksi alış iadeleri")+stat("Müşteri Alacakları",money(d.receivables),"amber","Pozitif cari bakiyeler")+stat("Tedarikçi Borçları",money(d.payables),"","Negatif cari bakiyeler")+stat("Kasa Mevcudu",money(d.cash),"green","İşlenen kasa giriş / çıkışları")+stat("Banka Toplamı",money(d.bank),"","Kayıtlı banka hareketleri")+stat("Stok Maliyet Değeri",money(d.stockCost),"","Son kayıtlı alış fiyatıyla")+stat("Toplam Fatura",String(d.invoices),"",d.products+" ürün · "+d.parties+" cari")+"</div>";
  const actions=[["invoice","Satış Faturası","primary"],["product","Ürün Ekle"],["party","Cari Ekle"],["payment","Tahsilat / Ödeme"]];
  const recent=table(d.recent,[["number","Fatura"],["date","Tarih"],["kind","Tür"],["party_name","Cari"],["total_cents","Tutar","num"]],{actions:r=>'<button class="btn small secondary" data-print="'+r.id+'">Görüntüle</button>'});
  const stocks=table(d.lowStock,[["code","Ürün Kodu"],["name","Ürün Adı"],["stock_milli","Stok","num"]]);
  main.innerHTML=hero("İŞLETME MERKEZİ","İşletmenizin tüm hareketleri tek ekranda","Satış, alış, stok ve finans durumunuz yerel veritabanında güncel tutulur.",actions)+cards+'<div class="split">'+panel("Son Faturalar","Son oluşturulan 10 belge",recent)+panel("Düşük Stok Uyarıları","5 adetten az kalan ürünler",stocks)+"</div>";
 }else if(tab==="reports"){
  const r=await call("report");
  const m=r.monthly.map(x=>({month:x.month,sales:x.sales||0,purchases:x.purchases||0}));
  main.innerHTML=hero("RAPORLAMA","Finansal Raporlar","Veriler anlık olarak kendi yerel veritabanınızdan hesaplanır.")+
  '<div class="cards">'+stat("Satış",money(r.summary.sales),"green")+stat("Alış",money(r.summary.purchases))+stat("Stok Değeri",money(r.summary.stockCost))+stat("Bekleyen Gecikmiş Evrak",String(r.summary.overdue),"amber")+"</div>"+
  '<div class="notice">Bu rapor işletme içi ön muhasebe amaçlıdır. Resmî mali tablo, e-Fatura veya yasal beyanname değildir.</div>'+
  tableSection("Aylık Satış ve Alışlar","Son 24 ay; iadeler düşülmüştür",m,[["month","Ay"],["sales","Net Satış"],["purchases","Net Alış"]])+
  tableSection("Stok Değerleme","Son kayıtlı alış fiyatı üzerinden",r.inventory,[["code","Kod"],["name","Ürün"],["stock_milli","Stok"],["purchase_cents","Maliyet"],["value_cents","Stok Değeri"]]);
  $("#main").insertAdjacentHTML("afterbegin",'<div class="table-tools"><button class="btn secondary" id="csv-report">Aylık Rapor CSV İndir</button><button class="btn secondary" id="csv-inventory">Stok Raporu CSV İndir</button></div>');
  window._reportData={m,inventory:r.inventory};
 }else if(tab==="settings"){
  const settings=Object.fromEntries((await call("settings")).map(x=>[x.key,x.value]));
  main.innerHTML=hero("SİSTEM YÖNETİMİ","İşletme Bilgileri & Yedekleme","Tüm kayıtlar yalnızca bu bilgisayarda tutulur.")+
  '<section class="panel"><div class="panel-heading"><div><h3>İşletme Kimliği</h3><div class="sub">Yazdırılan dahili fatura çıktılarında gösterilir</div></div></div><div class="panel-body"><div class="section-actions">'+toolbar([["settings","İşletme Bilgilerini Düzenle","primary"]])+'</div><p><b>'+esc(settings.company)+'</b><br>'+esc(settings.address||"Adres eklenmemiş")+'<br>'+esc(settings.phone||"")+' · '+esc(settings.tax||"")+"</p></div></section>"+
  '<section class="panel"><div class="panel-heading"><div><h3>Yedekleme ve Veri Güvenliği</h3><div class="sub">Yedek: tek bir .sqlite dosyasıdır; internete gönderilmez</div></div></div><div class="panel-body"><p class="desc">Her gün uygulama açılırken otomatik yerel yedek oluşturulur. Ek olarak harici diskinize / buluta kendiniz yedek kopyalayabilirsiniz.</p><br><div class="section-actions"><button class="btn primary" id="backup-now">Veritabanı Yedeğini Dışa Aktar</button><button class="btn warning" id="restore-now">Yedekten Geri Yükle</button></div></div></section>'+
  '<div class="notice">Dikkat: Resmî e-Fatura/e-Arşiv kesme veya GİB sistemine gönderme özelliği bu sürümde bulunmaz. Yedek geri yükleme mevcut kayıtların üzerine yazar. Bu bilgisayardaki veriler, başka bir bilgisayarın verileriyle otomatik senkronize edilmez.</div>';
  window._settings=settings;
 }else{
   const kind=tab==="stock"?"movements":tab==="checks"?"instruments":tab==="cash"?"cash_movements":tab;
   const acts=tab==="invoices"?[["invoice","Yeni Fatura","primary"]]:
    tab==="products"?[["product","Yeni Ürün","primary"],["stockAdjust","Stok Giriş / Çıkış"]]:
    tab==="stock"?[["stockAdjust","Stok Giriş / Çıkış","primary"],["invoice","Alış / Satış Faturası"]]:
    tab==="parties"?[["party","Yeni Cari","primary"],["payment","Tahsilat / Ödeme"]]:
    tab==="ledger"?[["payment","Tahsilat / Ödeme","primary"]]:
    tab==="orders"?[["order","Yeni Sipariş","primary"]]:
    tab==="banks"?[["bank","Yeni Banka","primary"],["bankMovement","Banka Hareketi"],["payment","Tahsilat / Ödeme"]]:
    tab==="cash"?[["cashMovement","Kasa Giriş / Çıkış","primary"],["payment","Tahsilat / Ödeme"]]:
    tab==="checks"?[["instrument","Çek / Senet Ekle","primary"]]:[];
   const title=(nav.find(x=>x[0]===tab)||nav[0])[2];
   const descriptions={invoices:"Satış, alış ve iadeler otomatik olarak stok ile cari hareketlerini işler.",products:"Ürün fiyatları, barkodlar ve güncel stoklar.",stock:"Alış, satış, iade ve sayım işlemlerinin değiştirilemez hareket geçmişi.",parties:"Müşteri ve tedarikçilerinizin hesap kartları ve bakiye durumları.",ledger:"Alacak ve borç hareketleri; pozitif bakiye alacağınız, negatif bakiye borcunuzdur.",orders:"Satış ve satın alma siparişlerinin işlem takibi.",banks:"Banka hesaplarınız ve işlem geçmişi.",cash:"Nakit kasa ile yapılan tahsilat ve ödemeler.",checks:"Alınan ve verilen çek/senetler; evrak durumunu değiştirince otomatik tahsilat kaydedilmez."};
   let kindActions={invoices:r=>'<button class="btn small secondary" data-print="'+r.id+'">Aç / Yazdır</button>',
     products:r=>'<button class="btn small secondary" data-edit="product" data-id="'+r.id+'">Düzenle</button>',
     parties:r=>'<button class="btn small secondary" data-edit="party" data-id="'+r.id+'">Düzenle</button>',
     orders:r=>r.status==="open"?'<button class="btn small secondary" data-status="order" data-id="'+r.id+'">Kapat</button>':"",
     checks:r=>r.status==="pending"?'<button class="btn small secondary" data-status="instrument" data-id="'+r.id+'">Durum İşlemi</button>':""}[tab];
   let rows=await call("list",{kind}),cols=columns[kind];
   main.innerHTML=hero("MUHASEBE KAYITLARI",title,descriptions[tab]||"Yerel kayıtların tamamı",acts)+'<div class="table-tools"><input id="search-main" class="search" placeholder="Kayıtlarda ara..."><button class="btn secondary" id="csv-main">CSV Olarak İndir</button></div>'+
   tableSection("Kayıt Listesi",rows.length+" kayıt",rows,cols,kindActions,false);
   window._table={rows,cols,kindActions};
   if(tab==="banks"){
     const moves=await call("list",{kind:"bank_movements"});
     main.insertAdjacentHTML("beforeend",tableSection("Banka Hesap Hareketleri",moves.length+" hareket",moves,columns.bank_movements));
   }else if(tab==="cash"){
     const payments=await call("list",{kind:"payments"});
     main.insertAdjacentHTML("beforeend",tableSection("Tahsilatlar ve Ödemeler",payments.length+" işlem",payments,columns.payments));
   }else if(tab==="parties"){
     const ledger=await call("list",{kind:"ledger"});
     main.insertAdjacentHTML("beforeend",tableSection("Cari Hareket Geçmişi",ledger.length+" hareket",ledger.slice(0,80),columns.ledger));
   }
 }
 }catch(e){$("#main").innerHTML='<div class="notice">Ekran açılamadı: '+esc(e.message)+'</div>';toast(e.message,true);}
}
function csvDownload(data,cols,name){
 const head=cols.map(x=>x[1]).join(";"),lines=data.map(r=>cols.map(c=>{
  let v=r[c[0]]??"";if(["kind","status","direction","method"].includes(c[0]))v=labels[v]||v;
  if(c[0].endsWith("_cents")||c[0]==="balance"||c[0]==="sales"||c[0]==="purchases")v=(Number(v)/100).toFixed(2).replace(".",",");
  if(c[0].endsWith("_milli"))v=(Number(v)/1000).toString().replace(".",",");
  return '"'+String(v).replace(/"/g,'""')+'"';
 }).join(";"));
 const blob=new Blob(["\uFEFF",head,"\n",...lines.map(l=>l+"\n")],{type:"text/csv;charset=utf-8;"});
 const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name+"-"+localDate()+".csv";document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);
}
const asOptions=(arr,name,label)=>arr.map(x=>({value:String(x.id),label:x[label]||x[name]}));
const definitions={
  party:{title:"Cari Hesap Kartı",fields:[["name","Firma / Cari Adı","text",true],["kind","Cari Türü","select",true,[["customer","Müşteri"],["supplier","Tedarikçi"],["both","Her İkisi"]]],["tax","Vergi / T.C. No","text"],["phone","Telefon","text"],["email","E-posta","email"],["address","Adres","textarea"]]},
  product:{title:"Stok Ürün Kartı",fields:[["code","Ürün Kodu","text",true],["barcode","Barkod","text"],["name","Ürün Adı","text",true],["unit","Birim","select",true,[["Adet","Adet"],["Koli","Koli"],["Paket","Paket"],["Kg","Kg"],["Metre","Metre"]]],["purchase","Birim Alış Fiyatı (TL)","number",true],["sale","Birim Satış Fiyatı (TL)","number",true]]},
  bank:{title:"Banka Hesabı Oluştur",fields:[["name","Banka / Hesap Adı","text",true],["iban","IBAN","text"]]},
  stockAdjust:{title:"Stok Giriş / Çıkış",fields:[["id","Ürün","products",true],["direction","Hareket Türü","select",true,[["increase","Stok Girişi"],["decrease","Stok Çıkışı"]]],["qty","Miktar","number",true],["notes","Açıklama","textarea"]]},
  invoice:{title:"Fatura / İade Kaydı",fields:[["kind","Belge Türü","select",true,[["sale","Satış Faturası"],["purchase","Alış Faturası"],["sale_return","Satış İadesi"],["purchase_return","Alış İadesi"]]],["number","Belge / Fatura No","text",true],["date","Belge Tarihi","date",true],["partyId","Cari Hesap","parties",true],["notes","Açıklama","textarea"]],lines:true},
  order:{title:"Sipariş Oluştur",fields:[["kind","Sipariş Türü","select",true,[["sale","Satış Siparişi"],["purchase","Alış Siparişi"]]],["number","Sipariş No","text",true],["date","Tarih","date",true],["partyId","Cari Hesap","parties",true],["notes","Açıklama","textarea"]],lines:true},
  payment:{title:"Tahsilat / Ödeme",fields:[["kind","İşlem","select",true,[["collection","Tahsilat Aldım"],["payment","Ödeme Yaptım"]]],["partyId","Cari Hesap","parties",true],["method","Yöntem","select",true,[["cash","Nakit Kasa"],["bank","Banka"]]],["bankId","Banka Hesabı","banks"],["amount","Tutar (TL)","number",true],["date","Tarih","date",true],["notes","Açıklama","textarea"]]},
  bankMovement:{title:"Banka Para Giriş / Çıkışı",fields:[["bankId","Banka Hesabı","banks",true],["direction","Yön","select",true,[["in","Para Girişi"],["out","Para Çıkışı"]]],["amount","Tutar (TL)","number",true],["notes","Açıklama","textarea",true]]},
  cashMovement:{title:"Kasa Nakit Giriş / Çıkışı",fields:[["direction","Yön","select",true,[["in","Nakit Girişi"],["out","Nakit Çıkışı"]]],["amount","Tutar (TL)","number",true],["notes","Açıklama","textarea",true]]},
  instrument:{title:"Çek / Senet Kaydı",fields:[["kind","Evrak Türü","select",true,[["cheque","Çek"],["note","Senet"]]],["direction","İşlem","select",true,[["received","Alınan"],["issued","Verilen"]]],["partyId","Cari Hesap","parties",true],["number","Evrak Numarası","text",true],["amount","Tutar (TL)","number",true],["dueDate","Vade Tarihi","date",true],["bankName","Banka","text"],["notes","Açıklama","textarea"]]},
  instrumentStatus:{title:"Evrak Durumunu Değiştir",fields:[["status","Yeni Durum","select",true,[["collected","Tahsil / Ödeme Tamamlandı"],["bounced","Karşılıksız"],["cancelled","İptal"]]]]},
  orderStatus:{title:"Sipariş Durumu",fields:[["status","Yeni Durum","select",true,[["completed","Tamamlandı"],["cancelled","İptal"]]]]},
  settings:{title:"İşletme Bilgileri",fields:[["company","İşletme Unvanı","text",true],["tax","Vergi Numarası / Dairesi","text"],["phone","Telefon","text"],["address","Adres","textarea"]]}
};
let choices={};
async function openForm(type,item={}){
 const def=definitions[type];if(!def)return;
 currentForm=type;activeEdit=item||{};lineCount=0;
 try{
 const want=new Set(def.fields.map(x=>x[2]));if(def.lines)want.add("products");
 const jobs=[];
 if(want.has("parties"))jobs.push(call("list",{kind:"parties"}).then(x=>choices.parties=asOptions(x,"name","name")));
 if(want.has("products"))jobs.push(call("list",{kind:"products"}).then(x=>{choices.products=asOptions(x,"name","name");choices.productRecords=x;}));
 if(want.has("banks"))jobs.push(call("list",{kind:"banks"}).then(x=>choices.banks=asOptions(x,"name","name")));
 await Promise.all(jobs);
 if(def.lines&&(!choices.products||choices.products.length===0))return toast("Önce ürün kartı oluşturun",true);
 if(want.has("parties")&&(!choices.parties||choices.parties.length===0))return toast("Önce cari hesap oluşturun",true);
 if(want.has("banks")&&(!choices.banks||choices.banks.length===0)&&type==="bankMovement")return toast("Önce banka hesabı oluşturun",true);
 $("#dialog-title").textContent=(item.id&&["party","product"].includes(type)?"Düzenle: ":"")+def.title;
 const pre=type==="settings"?(window._settings||{}):item;
 $("#form-fields").innerHTML=def.fields.map(f=>formField(f,pre[f[0]])).join("")+(def.lines?'<div class="lines-wrap"><div class="lines-head"><strong>Ürün Satırları</strong><button type="button" id="add-line" class="btn small secondary">+ Satır Ekle</button></div><div id="lines"></div><div class="total-preview" id="total-preview">Toplam: ₺0,00</div></div>':"")+(type==="instrumentStatus"?'<p class="field-note">Evrakı kapatmak muhasebe tahsilatı oluşturmaz. İlgili tahsilat / ödemeyi ayrıca giriniz.</p>':"");
 $("#modal").classList.remove("hidden");if(def.lines)addLine();
 if(type==="payment")toggleBankVisibility();
 }catch(e){toast(e.message,true);}
}
function formField(f,val){const [name,title,type,required,opts]=f,wide=type==="textarea"?" wide":"",value=val??(type==="date"?localDate():"");
 let control="",attr=' name="'+name+'" id="f-'+name+'" '+(required?"required":"");
 if(type==="select"||["parties","products","banks"].includes(type)){
  const options=opts||choices[type]||[];
  control='<select'+attr+'><option value="">Seçiniz...</option>'+options.map(opt=>{const k=Array.isArray(opt)?opt[0]:opt.value,t=Array.isArray(opt)?opt[1]:opt.label;return '<option value="'+esc(k)+'"'+(String(k)===String(value)?" selected":"")+'>'+esc(t)+'</option>';}).join("")+"</select>";
 }else if(type==="textarea")control='<textarea'+attr+' maxlength="1000">'+esc(value)+"</textarea>";
 else control='<input type="'+type+'"'+attr+(type==="number"?' step="0.001" min="0" inputmode="decimal"':"")+' value="'+esc(value)+'">';
 return '<div class="field'+wide+'" id="wrap-'+name+'"><label for="f-'+name+'">'+esc(title)+'</label>'+control+"</div>";
}
function addLine(){
 lineCount++;const idx=lineCount,p=choices.products||[];
 const opts=p.map(x=>'<option value="'+esc(x.value)+'">'+esc(x.label)+"</option>").join("");
 const html='<div class="line-grid" data-line="'+idx+'"><div><label>Ürün</label><select class="ln-product"><option value="">Ürün seçiniz...</option>'+opts+'</select></div><div><label>Miktar</label><input class="ln-qty" type="number" min="0.001" step="0.001" value="1"></div><div><label>Birim Fiyat TL</label><input class="ln-price" type="number" min="0" step="0.01" value="0"></div><div><label>KDV</label><select class="ln-vat"><option value="20">%20</option><option value="10">%10</option><option value="1">%1</option><option value="0">%0</option></select></div><button type="button" class="rm-line" aria-label="Satırı kaldır">✕</button></div>';
 $("#lines").insertAdjacentHTML("beforeend",html);calcTotal();
}
function calcTotal(){
 if(!$("#lines"))return;let total=0;
 for(const l of document.querySelectorAll(".line-grid")){
  const q=Number(l.querySelector(".ln-qty").value)||0,p=Number(l.querySelector(".ln-price").value)||0,v=Number(l.querySelector(".ln-vat").value)||0;total+=q*p*(1+v/100);
 }
 $("#total-preview").textContent="Tahmini toplam: "+total.toLocaleString("tr-TR",{style:"currency",currency:"TRY"})+" (KDV dahil)";
}
function toggleBankVisibility(){const field=$("#wrap-bankId");if(!field)return;field.style.display=$("#f-method").value==="bank"?"flex":"none";$("#f-bankId").required=$("#f-method").value==="bank";}
function closeForm(){$("#modal").classList.add("hidden");$("#entry-form").reset();}
async function submit(ev){
 ev.preventDefault();if(busy)return;
 const form=$("#entry-form");if(!form.reportValidity())return;
 let p=Object.fromEntries(new FormData(form).entries());
 if(definitions[currentForm].lines){
  p.lines=Array.from(document.querySelectorAll(".line-grid")).map(l=>({productId:l.querySelector(".ln-product").value,qty:l.querySelector(".ln-qty").value,price:l.querySelector(".ln-price").value,vat:l.querySelector(".ln-vat").value}));
  if(p.lines.some(x=>!x.productId||Number(x.qty)<=0))return toast("Ürün satırlarını ve miktarları kontrol edin",true);
 }
 const map={party:"addParty",product:"addProduct",invoice:"addInvoice",order:"addOrder",stockAdjust:"adjustStock",bank:"addBank",payment:"addPayment",bankMovement:"bankMovement",cashMovement:"cashMovement",instrument:"addInstrument",instrumentStatus:"instrumentStatus",orderStatus:"orderStatus",settings:"saveSettings"};
 let operation=map[currentForm];if(activeEdit.id){p.id=activeEdit.id;if(currentForm==="party")operation="updateParty";if(currentForm==="product")operation="updateProduct";}
 busy=true;$("#save-form").disabled=true;
 try{await call(operation,p);closeForm();toast("İşlem başarıyla kaydedildi");await screen();}catch(e){toast(e.message,true);}finally{busy=false;$("#save-form").disabled=false;}
}
$("#nav").addEventListener("click",e=>{const btn=e.target.closest("[data-nav]");if(btn){tab=btn.dataset.nav;screen();}});
$("#main").addEventListener("click",async e=>{
 const formBtn=e.target.closest("[data-form]");if(formBtn)return openForm(formBtn.dataset.form);
 const editBtn=e.target.closest("[data-edit]");if(editBtn){const records=await invoke("list",{kind:editBtn.dataset.edit==="product"?"products":"parties"});const item=records.find(x=>String(x.id)===editBtn.dataset.id);if(!item)return; if(editBtn.dataset.edit==="product")return openForm("product",{...item,purchase:Number(item.purchase_cents)/100,sale:Number(item.sale_cents)/100});return openForm("party",{...item,tax:item.tax_id});}
 const statusBtn=e.target.closest("[data-status]");if(statusBtn)return openForm(statusBtn.dataset.status==="order"?"orderStatus":"instrumentStatus",{id:statusBtn.dataset.id});
 const printBtn=e.target.closest("[data-print]");if(printBtn){const r=await window.dukkan.print(Number(printBtn.dataset.print));if(!r.ok)toast(r.error,true);return;}
 if(e.target.id==="csv-main"&&window._table)return csvDownload(window._table.rows,window._table.cols,tab);
 if(e.target.id==="csv-report")return csvDownload(window._reportData.m,[["month","Ay"],["sales","Net Satış"],["purchases","Net Alış"]],"aylik-rapor");
 if(e.target.id==="csv-inventory")return csvDownload(window._reportData.inventory,[["code","Kod"],["name","Ürün"],["stock_milli","Stok"],["value_cents","Stok Değeri"]],"stok-raporu");
 if(e.target.id==="backup-now")return doBackup();
 if(e.target.id==="restore-now")return doRestore();
});
$("#main").addEventListener("input",e=>{
 if(e.target.id!=="search-main")return;const term=e.target.value.toLocaleLowerCase("tr-TR");
 const {rows,cols,kindActions}=window._table,shown=rows.filter(r=>cols.some(c=>String(labels[r[c[0]]]||r[c[0]]||"").toLocaleLowerCase("tr-TR").includes(term)));
 $("#table-host").innerHTML=table(shown,cols,{actions:kindActions});
});
$("#form-fields").addEventListener("click",e=>{if(e.target.id==="add-line")addLine();if(e.target.classList.contains("rm-line")){e.target.closest(".line-grid").remove();calcTotal();}});
$("#form-fields").addEventListener("change",e=>{
 if(e.target.classList.contains("ln-product")){const product=(choices.productRecords||[]).find(x=>String(x.id)===e.target.value);if(product){const price=e.target.closest(".line-grid").querySelector(".ln-price");const k=$("#f-kind")?.value;price.value=String(Number((k==="sale"||k==="sale_return"?product.sale_cents:product.purchase_cents)||0)/100);}}
 if(e.target.id==="f-method")toggleBankVisibility();calcTotal();
});
$("#form-fields").addEventListener("input",e=>{if(e.target.closest(".line-grid"))calcTotal();});
$("#entry-form").addEventListener("submit",submit);
$("#modal-shade").addEventListener("click",closeForm);$("#modal-close").addEventListener("click",closeForm);$("#cancel-form").addEventListener("click",closeForm);
$("#new-top").addEventListener("click",()=>openForm(({invoices:"invoice",products:"product",stock:"stockAdjust",parties:"party",ledger:"payment",orders:"order",banks:"bank",cash:"cashMovement",checks:"instrument",settings:"settings"})[tab]||"invoice"));
async function doBackup(){try{const r=await window.dukkan.backup();if(r.ok)toast("Yedek dosyası kaydedildi: "+r.path);}catch(e){toast(e.message,true);}}
async function doRestore(){try{const r=await window.dukkan.restore();if(r.ok){toast("Yedek geri yüklendi");screen();}else if(r.error)toast(r.error,true);}catch(e){toast(e.message,true);}}
$("#backup-top").addEventListener("click",doBackup);
$("#today").textContent=new Date().toLocaleDateString("tr-TR",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
screen();