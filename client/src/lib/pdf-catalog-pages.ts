/** Client-only PDF page renderer for complete B2B catalogue import.
 * Image boxes are supplied by visual extraction and refer to the SAME page,
 * on a 0..1000 coordinate system. Never search online as a substitute for
 * uncertain document images.
 */
export type SourceImageBox={x:number;y:number;width:number;height:number};
export type RenderedCataloguePage={
  pageNumber:number;totalPages:number;filename:string;dataUrl:string;
  crop:(box:SourceImageBox)=>string|null;
};
function safeBox(b:SourceImageBox){
 return [b.x,b.y,b.width,b.height].every(Number.isFinite)&&
   b.x>=0&&b.y>=0&&b.width>10&&b.height>10&&
   b.x+b.width<=1000&&b.y+b.height<=1000&&
   b.width<=450&&b.height<=500;
}
export function cropProductImage(canvas:HTMLCanvasElement,box:SourceImageBox):string|null{
 if(!safeBox(box))return null;
 const left=Math.max(0,Math.floor(canvas.width*(box.x/1000)));
 const top=Math.max(0,Math.floor(canvas.height*(box.y/1000)));
 const width=Math.min(canvas.width-left,Math.ceil(canvas.width*(box.width/1000)));
 const height=Math.min(canvas.height-top,Math.ceil(canvas.height*(box.height/1000)));
 if(width<30||height<30)return null;
 // Upscale modestly for readable image details, keep individual output small.
 const scale=Math.min(2,900/Math.max(width,height));
 const out=document.createElement('canvas');
 out.width=Math.max(1,Math.round(width*scale));
 out.height=Math.max(1,Math.round(height*scale));
 const ctx=out.getContext('2d');
 if(!ctx)return null;
 ctx.fillStyle='#ffffff';ctx.fillRect(0,0,out.width,out.height);
 ctx.drawImage(canvas,left,top,width,height,0,0,out.width,out.height);
 return out.toDataURL('image/jpeg',.90);
}
export async function* renderCataloguePdf(file:File):AsyncGenerator<RenderedCataloguePage>{
 // Lazy import avoids adding PDF.js to the normal admin product pages.
 const pdfjs=await import('pdfjs-dist/build/pdf.mjs');
 const worker=await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
 pdfjs.GlobalWorkerOptions.workerSrc=worker.default;
 const pdf=await pdfjs.getDocument({
   data:new Uint8Array(await file.arrayBuffer()),
   isEvalSupported:false,
   useSystemFonts:true,
 }).promise;
 if(pdf.numPages>100)throw Error('Bir PDF en fazla 100 sayfa içerebilir. Dosyayı bölerek yükleyin.');
 try{
   for(let n=1;n<=pdf.numPages;n++){
     const page=await pdf.getPage(n);
     const base=page.getViewport({scale:1});
     const scale=Math.min(3,Math.sqrt(5_500_000/(base.width*base.height)));
     const viewport=page.getViewport({scale});
     const canvas=document.createElement('canvas');
     canvas.width=Math.ceil(viewport.width);
     canvas.height=Math.ceil(viewport.height);
     const context=canvas.getContext('2d',{alpha:false});
     if(!context)throw Error('PDF sayfa çizimi desteklenmiyor.');
     await page.render({canvas,canvasContext:context,viewport}).promise;
     const dataUrl=canvas.toDataURL('image/jpeg',.90);
     yield {
       pageNumber:n,totalPages:pdf.numPages,
       filename:file.name+' · Sayfa '+n,
       dataUrl,crop:box=>cropProductImage(canvas,box)
     };
     page.cleanup();
   }
 }finally{await pdf.destroy();}
}
