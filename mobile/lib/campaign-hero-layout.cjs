'use strict';

/** Fit the entire campaign artwork across the device width, trimming only the
 * configurable top/bottom letterboxing. Never use cover or overlay duplicate
 * marketing copy on an image that already contains its own typography.
 */
function campaignHeroLayout(viewportWidth,sourceWidth,sourceHeight,cropSetting=12){
  const width=Number.isFinite(viewportWidth)&&viewportWidth>0?viewportWidth:375;
  const iw=Number.isFinite(sourceWidth)&&sourceWidth>0?sourceWidth:1448;
  const ih=Number.isFinite(sourceHeight)&&sourceHeight>0?sourceHeight:378;
  const crop=Number.isFinite(cropSetting)?Math.max(0,Math.min(20,cropSetting)):12;
  const scaledHeight=width*ih/iw;
  const cropPx=scaledHeight*crop/100;
  return {
    width,
    imageHeight:scaledHeight,
    frameHeight:Math.max(1,scaledHeight-2*cropPx),
    top:-cropPx,
    cropPercent:crop,
  };
}
function showOnlyCampaignArtwork(imageId){
  return typeof imageId==='string'&&imageId.trim().length>0;
}
module.exports={campaignHeroLayout,showOnlyCampaignArtwork};
