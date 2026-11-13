import {useRef,useState,type DragEvent,type ChangeEvent} from "react";
import {ImagePlus,Loader2,Package} from "lucide-react";
import {fileToCompressedDataUrl} from "@/lib/compress-image";

export function DukkanProductThumbnailDrop({
  productName,imageUrl,endpoint,enabled,onSaved,onError,
}:{
  productName:string;
  imageUrl?:string|null;
  endpoint?:string;
  enabled:boolean;
  onSaved:()=>void;
  onError:(message:string)=>void;
}){
  const inputRef=useRef<HTMLInputElement|null>(null);
  const [dragging,setDragging]=useState(false);
  const [uploading,setUploading]=useState(false);
  const [currentPreview,setCurrentPreview]=useState<string|null>(null);
  const uploadingRef=useRef(false);
  const [inlineError,setInlineError]=useState("");
  const picture=currentPreview||imageUrl||null;

  async function upload(file:File|undefined){
    if(!file||!enabled||!endpoint||uploadingRef.current)return;
    if(!["image/png","image/jpeg","image/webp"].includes(file.type)){
      const message="PNG, JPG veya WebP görsel seçin.";
      setInlineError(message);onError(message);return;
    }
    if(file.size>15_000_000){
      const message="Görsel 15 MB sınırını aşıyor. Daha küçük dosya seçin.";
      setInlineError(message);onError(message);return;
    }
    uploadingRef.current=true;
    setUploading(true);setInlineError("");
    try{
      const image=await fileToCompressedDataUrl(file);
      if(image.length>3_000_000)throw new Error("Sıkıştırılmış görsel 3 MB sınırını aşıyor.");
      const response=await fetch(endpoint,{
        method:"PATCH",credentials:"include",cache:"no-store",
        headers:{"Content-Type":"application/json"},body:JSON.stringify({image}),
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||"Görsel kaydedilemedi.");
      setCurrentPreview(image);
      onSaved();
    }catch(error){
      const message=error instanceof Error?error.message:"Görsel ekleme başarısız.";
      setInlineError(message);onError(message);
    }finally{
      uploadingRef.current=false;
      setUploading(false);
    }
  }
  const drop=(event:DragEvent<HTMLDivElement>)=>{
    event.preventDefault();event.stopPropagation();setDragging(false);
    if(!enabled||uploadingRef.current)return;
    const files=Array.from(event.dataTransfer.files);
    if(files.length!==1){
      const message="Küçük görsel alanına her seferinde yalnızca 1 görsel bırakın.";
      setInlineError(message);onError(message);
      return;
    }
    void upload(files[0]);
  };
  const change=(event:ChangeEvent<HTMLInputElement>)=>{
    const file=event.target.files?.[0];
    event.target.value="";
    void upload(file);
  };
  const pictureContent=picture?
    <img src={picture} alt={productName} loading="lazy"
      className="h-full w-full rounded-xl object-contain"/>:
    <Package size={21} className="text-slate-400" aria-hidden="true"/>;
  if(!enabled||!endpoint)
    return <span className="grid h-14 w-14 place-items-center rounded-xl border border-slate-100 bg-slate-100" title={productName}>{pictureContent}</span>;

  return <div className="relative inline-block"
    onClick={event=>event.stopPropagation()}
    onDragEnter={event=>{
      if(!event.dataTransfer.types.includes("Files"))return;
      event.preventDefault();event.stopPropagation();setDragging(true);
    }}
    onDragOver={event=>{
      if(!event.dataTransfer.types.includes("Files"))return;
      event.preventDefault();event.stopPropagation();
      event.dataTransfer.dropEffect=uploadingRef.current?"none":"copy";
      setDragging(true);
    }}
    onDragLeave={event=>{
      event.preventDefault();event.stopPropagation();
      if(!event.currentTarget.contains(event.relatedTarget as Node|null))setDragging(false);
    }}
    onDrop={drop}>
    <button type="button"
      title={productName+" · Görsel sürükleyip bırakın veya seçmek için tıklayın"}
      aria-label={productName+" · Küçük görsel ekle veya değiştir"}
      disabled={uploading}
      onClick={()=>inputRef.current?.click()}
      className={"group relative grid h-14 w-14 place-items-center overflow-hidden rounded-xl border-2 border-dashed bg-white transition focus-visible:outline-2 focus-visible:outline-sky-500 "+
        (dragging?"border-sky-600 bg-sky-100 ring-4 ring-sky-100":
        "border-slate-200 hover:border-sky-400 hover:bg-sky-50")}>
      {pictureContent}
      {uploading?<span className="absolute inset-0 grid place-items-center bg-white/85"><Loader2 size={22} className="animate-spin text-blue-700"/></span>:
        <span className="absolute bottom-0 right-0 grid h-5 w-5 place-items-center rounded-tl-lg bg-[#153f76]/90 text-white group-hover:bg-sky-700">
          <ImagePlus size={12}/>
        </span>}
      {dragging&&<span className="absolute inset-0 grid place-items-center bg-sky-100/95 text-[9px] font-bold text-blue-800">Bırak</span>}
    </button>
    <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp"
      className="sr-only" tabIndex={-1} aria-label={productName+" görsel dosyası"}
      disabled={uploading} onChange={change}/>
    {inlineError&&<span role="alert" className="absolute left-0 top-full z-30 mt-1 w-52 rounded-lg border border-rose-200 bg-white px-2 py-1 text-[10px] text-rose-800 shadow-md">{inlineError}</span>}
  </div>;
}
