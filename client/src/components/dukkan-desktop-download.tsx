import { useCallback, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Download, ExternalLink, Laptop, Loader2, RefreshCw, ShieldCheck } from "lucide-react";

const REPOSITORY="https://github.com/erdcss/CRM-RMA-PANEL";
const RELEASES_API="https://api.github.com/repos/erdcss/CRM-RMA-PANEL/releases?per_page=30";
const INSTALLER_NAME="Caliskan-Dukkan-Setup.exe";
const RELEASE_PREFIX="dukkan-desktop-v";

type ReleaseAsset={
  name?:string;
  size?:number;
  browser_download_url?:string;
  state?:string;
};
type Release={
  tag_name?:string;
  name?:string;
  published_at?:string;
  draft?:boolean;
  prerelease?:boolean;
  html_url?:string;
  assets?:ReleaseAsset[];
};
type Installer={
  version:string;
  publishedAt:string;
  downloadUrl:string;
  sizeBytes:number;
  releaseUrl:string;
};
function selectCurrentInstaller(input:unknown):Installer|null {
  if(!Array.isArray(input))throw Error("GitHub sürüm yanıtı okunamadı.");
  const releases=(input as Release[]).filter(value=>
    value&&!value.draft&&!value.prerelease&&
    typeof value.tag_name==="string"&&value.tag_name.startsWith(RELEASE_PREFIX)
  );
  for(const release of releases){
    const file=release.assets?.find(asset=>asset.name===INSTALLER_NAME&&
      typeof asset.browser_download_url==="string"&&
      asset.state==="uploaded"&&(asset.size||0)>1_000_000);
    if(!file)continue;
    const url=new URL(file.browser_download_url!);
    if(url.protocol!=="https:"||url.hostname!=="github.com"||
       !url.pathname.startsWith("/erdcss/CRM-RMA-PANEL/releases/download/")||
       !url.pathname.endsWith("/"+INSTALLER_NAME))continue;
    return {
      version:release.tag_name!.replace(RELEASE_PREFIX,""),
      publishedAt:release.published_at||"",
      downloadUrl:url.toString(),
      sizeBytes:file.size!,
      releaseUrl:release.html_url||REPOSITORY+"/releases",
    };
  }
  return null;
}

export function DukkanDesktopDownload(){
  const [installer,setInstaller]=useState<Installer|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [checkedAt,setCheckedAt]=useState<Date|null>(null);
  const check=useCallback(async(signal?:AbortSignal)=>{
    setLoading(true);
    setError("");
    try{
      const response=await fetch(RELEASES_API,{
        signal,cache:"no-store",
        headers:{Accept:"application/vnd.github+json"},
      });
      if(!response.ok)throw Error(response.status===403
        ?"GitHub sürüm sorgu sınırına ulaşıldı. Yayınlar sayfasından kontrol edin."
        :"Sürüm bilgisi alınamadı (HTTP "+response.status+").");
      const latest=selectCurrentInstaller(await response.json());
      if(signal?.aborted)return;
      setInstaller(latest);
      setCheckedAt(new Date());
    }catch(e){
      if(signal?.aborted)return;
      setError((e as Error).message);
    }finally{
      if(!signal?.aborted)setLoading(false);
    }
  },[]);
  useEffect(()=>{
    const controller=new AbortController();
    void check(controller.signal);
    // Settings stays current even while an administrator leaves the page open.
    const interval=window.setInterval(()=>{void check(controller.signal);},5*60*1000);
    return()=>{window.clearInterval(interval);controller.abort();};
  },[check]);
  const formatDate=(value:string)=>{
    if(!value)return "—";
    const dt=new Date(value);
    return Number.isNaN(dt.getTime())?"—":dt.toLocaleString("tr-TR",{
      day:"2-digit",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit"
    });
  };
  return <section aria-labelledby="dukkan-desktop-download-title"
    className="mb-5 rounded-[24px] border border-[#dce8f5] bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.035)] sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#ebf4ff] text-[#164b88]">
          <Laptop size={25}/>
        </span>
        <div>
          <h2 id="dukkan-desktop-download-title" className="text-lg font-black text-[#142d50]">
            Çalışkan Dükkan · Windows Masaüstü
          </h2>
          <p className="mt-1 text-sm text-[#60718b]">
            Windows 10/11, 64-bit · Masaüstü kurulum dosyası (.exe)
          </p>
        </div>
      </div>
      <button type="button" disabled={loading} onClick={()=>void check()}
        className="inline-flex items-center gap-2 rounded-xl border border-[#d7e3ef] bg-white px-3 py-2 text-xs font-bold text-[#315d87] hover:bg-[#f3f8ff] disabled:opacity-50"
        aria-label="En güncel masaüstü sürümünü yeniden kontrol et">
        {loading?<Loader2 size={15} className="animate-spin"/>:<RefreshCw size={15}/>}
        Sürümü Yenile
      </button>
    </div>
    <div className="mt-5 rounded-2xl border border-[#e2eaf4] bg-[#f6f9fd] p-4 sm:p-5">
      {loading&&!installer&&<div role="status" className="flex items-center gap-2 text-sm text-[#4b607a]">
        <Loader2 size={17} className="animate-spin"/> En son kurulum sürümü kontrol ediliyor…
      </div>}
      {error&&<p className="mb-3 flex items-start gap-2 text-sm text-amber-800" role="alert">
        <AlertCircle size={18} className="mt-0.5 shrink-0"/>{error}
      </p>}
      {installer?<div>
        <div className="flex flex-wrap items-center gap-2">
          <CheckCircle2 className="text-emerald-700" size={19}/>
          <span className="text-sm font-bold text-[#173f72]">İndirilebilir sürüm hazır</span>
          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-extrabold text-emerald-800">
            v{installer.version}
          </span>
        </div>
        <p className="mt-2 text-xs leading-6 text-[#61748c]">
          Yayın tarihi: {formatDate(installer.publishedAt)} · Dosya boyutu: {(installer.sizeBytes/1024/1024).toFixed(1)} MB
        </p>
        <a href={installer.downloadUrl} rel="noopener noreferrer"
          className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#122a51] px-5 py-3 text-sm font-extrabold text-white transition hover:bg-[#1c508e] sm:w-auto"
          aria-label={"Çalışkan Dükkan Windows kurulum v"+installer.version+" indir"}>
          <Download size={18}/> Güncel Windows Sürümünü İndir (.exe)
        </a>
      </div>:!loading&&<div className="flex items-start gap-3 text-sm text-[#536680]">
        <AlertCircle size={19} className="mt-0.5 shrink-0 text-amber-600"/>
        <div>
          <p className="font-bold text-[#233e62]">Windows kurulum dosyası henüz yayımlanmadı.</p>
          <p className="mt-1 text-xs leading-5">Kurulum oluşturma işlemi başarılı olduğunda en yeni sürüm burada otomatik olarak listelenecek.</p>
        </div>
      </div>}
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs">
        <a href={REPOSITORY+"/releases"} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-semibold text-[#17598f] hover:underline">
          GitHub sürümlerini aç <ExternalLink size={13}/>
        </a>
        {checkedAt&&<span className="text-[#738399]">Son kontrol: {checkedAt.toLocaleTimeString("tr-TR",{hour:"2-digit",minute:"2-digit"})}</span>}
      </div>
    </div>
    <div className="mt-4 flex items-start gap-2 text-xs leading-5 text-[#64748b]">
      <ShieldCheck size={17} className="mt-0.5 shrink-0 text-[#52709a]"/>
      <p>
        Masaüstü uygulaması canlı Çalışkan Dükkan panelini açar; internet bağlantısı gerektirir.
        Web panelindeki güncellemeler uygulama yeniden açıldığında kullanılabilir.
        Windows kurulum paketi henüz dijital olarak imzalanmadığından Windows güvenlik uyarısı gösterebilir.
      </p>
    </div>
  </section>;
}
