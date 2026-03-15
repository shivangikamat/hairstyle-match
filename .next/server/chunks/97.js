exports.id=97,exports.ids=[97],exports.modules={8359:()=>{},3739:()=>{},9650:(e,t,r)=>{"use strict";r.d(t,{yk:()=>N,Yx:()=>$,AL:()=>S});var n=r(8954);let a=[{keywords:["black","inky","jet"],color:"soft-black"},{keywords:["espresso","dark brown","rich brown"],color:"espresso"},{keywords:["brown","brunette","chocolate"],color:"chestnut"},{keywords:["copper","red","auburn"],color:"copper"},{keywords:["blonde","gold","honey"],color:"golden-blonde"}];function o(e,t){return t.some(t=>e.includes(t))}function i(e,t=[]){return[...t.filter(e=>"user"===e.speaker).map(e=>e.text.trim()).filter(Boolean).slice(-2),e.trim()].filter(Boolean).join(" ").trim()}function s(e,t,r,n=[]){let s=i(e,n),l=t.length>0?t:[{name:"Curtain Layers",reason:"A soft, wearable option with movement around the face."}],c=l.map(e=>({suggestion:e,score:function(e,t){let r=e.name.toLowerCase(),n=t.toLowerCase(),a=0;return r.includes("bob")&&o(n,["short","polished","clean","sharp","professional","low maintenance"])&&(a+=4),(r.includes("curtain")||r.includes("layer"))&&o(n,["soft","romantic","face framing","versatile","long","flowy"])&&(a+=4),r.includes("shag")&&o(n,["edgy","texture","volum","bold","cool","rock","lived in"])&&(a+=4),o(n,r.split(/\s+/))&&(a+=3),a}(e,s)+(e.name===r?2:0)})).sort((e,t)=>t.score-e.score)[0]?.suggestion||l[0],u=function(e,t=""){let r=function(e){let t=function(e){let t=e.toLowerCase();return t.includes("bob")?"bob":t.includes("shag")?"shag":"curtain"}(e);return"bob"===t?{silhouette:t,colorName:"espresso",part:"side",texture:"sleek",volume:"low",fringe:"wispy",length:"short",fit:{scale:1,offsetX:0,offsetY:0,width:.82,height:.84,rotation:0,opacity:.94}}:"shag"===t?{silhouette:t,colorName:"soft-black",part:"center",texture:"piecey",volume:"high",fringe:"wispy",length:"medium",fit:{scale:1,offsetX:0,offsetY:0,width:.82,height:.84,rotation:0,opacity:.94}}:{silhouette:t,colorName:"chestnut",part:"center",texture:"airy",volume:"medium",fringe:"curtain",length:"long",fit:{scale:1,offsetX:0,offsetY:0,width:.82,height:.84,rotation:0,opacity:.94}}}(e),n=t.toLowerCase();return r.colorName=function(e){let t=e.toLowerCase(),r=a.find(({keywords:e})=>o(t,e));return r?.color||"espresso"}(t),o(n,["side part","deep part"])?r.part="side":o(n,["center part","middle part"])&&(r.part="center"),o(n,["sleek","clean","polished","glassy"])?(r.texture="sleek",r.volume="low"):o(n,["soft","airy","romantic","light"])?r.texture="airy":o(n,["wavy","wave","bouncy"])?r.texture="wavy":o(n,["edgy","piecey","textured","rock"])&&(r.texture="piecey"),o(n,["volume","full","bigger","dramatic"])?r.volume="high":o(n,["minimal","sleek","flat","tame"])&&(r.volume="low"),o(n,["no bangs","no fringe","open forehead"])?r.fringe="none":o(n,["full fringe","blunt bangs"])?r.fringe="full":o(n,["curtain","face framing"])?r.fringe="curtain":o(n,["wispy","soft bangs"])&&(r.fringe="wispy"),o(n,["short","chin length","low maintenance"])?r.length="short":o(n,["shoulder","medium"])?r.length="medium":o(n,["long","longer","keep length"])&&(r.length="long"),r}(c.name,s),m=function(e){let t=e.trim();return t?t.length<=160?t:`${t.slice(0,157)}...`:"You want a flattering live preview that still feels wearable in real life."}(s);return{selectedStyle:c.name,mashupName:function(e,t){let r="sleek"===t.texture?"Gloss":"wavy"===t.texture?"Wave":"piecey"===t.texture?"Edge":"Soft";return"bob"===t.silhouette?`${r} Bob Halo`:"shag"===t.silhouette?`${r} Shag Remix`:`${r} Curtain Flow`}(c.name,u),preferencesSummary:m,agentReply:`I’d steer you toward ${c.name} for this live preview. It keeps the vibe aligned with “${m}” while staying believable on camera and easy to pitch as a stylist-ready cut.`,overlay:u}}let l="gemini-2.5-flash",c="gemini-2.5-flash-image",u=[{name:"Textured Bob",reason:"Adds movement and volume while softly framing most face shapes."},{name:"Curtain Layers",reason:"Long, face-framing layers that balance wide cheeks and soften sharp jawlines."},{name:"Modern Shag",reason:"Works well for wavy or straight hair, adding lift at the crown and definition around the eyes."}],m={faceShape:"oval",hairTexture:"unknown",skinTone:"unknown"},f=["bob","curtain","shag"],p=["soft-black","espresso","chestnut","copper","golden-blonde"],h=["center","side"],y=["sleek","airy","piecey","wavy"],d=["low","medium","high"],g=["none","curtain","wispy","full"],w=["short","medium","long"];function b(){let e=process.env.GEMINI_API_KEY||process.env.GOOGLE_API_KEY||null;return e?new n.fA({apiKey:e}):(console.warn("No Gemini API key found. Falling back to mock hairstyle responses."),null)}function v(e,t){return"string"==typeof e&&t.includes(e)}function k(e){if(!e.trim())return null;try{return JSON.parse(e)}catch{return null}}function x(e,t){return e&&0!==e.length&&t?.startsWith("image/")?{data:e.toString("base64"),mimeType:t}:null}async function N(e,t){let r=b();if(!r)return{faceProfile:m,suggestions:u};let n=`
You are a world-class hairstylist and face-shape analyst.

Look closely at this selfie and:
1) Infer the person's face shape, hair texture, and skin tone category.
2) Recommend 3 specific hairstyles that would be very flattering.

Respond with strict JSON only using this shape:
{
  "faceProfile": {
    "faceShape": "round | oval | square | heart | diamond | oblong",
    "hairTexture": "string",
    "skinTone": "string"
  },
  "suggestions": [
    {
      "name": "string",
      "reason": "string"
    }
  ]
}
`.trim(),a=x(e,t),o=k((await r.models.generateContent({model:l,contents:[{role:"user",parts:[{text:n},...a?[{inlineData:a}]:[]]}],config:{responseMimeType:"application/json",temperature:.4}})).text||"");return o&&Array.isArray(o.suggestions)&&0!==o.suggestions.length?o:{faceProfile:m,suggestions:u}}async function S(e){let{preferences:t,suggestions:r,currentStyle:n,conversationHistory:a=[]}=e,o=i(t,a),c=s(o,r,n,a),u=b();if(!u)return c;let m=`
You are a live celebrity hair stylist agent for a Gemini hackathon demo.

The user is talking to a webcam preview and wants a hairstyle mashup recommendation.
You must pick exactly one base style from this available list:
${r.map(e=>`- ${e.name}: ${e.reason}`).join("\n")}

Current selected style: ${n||"none"}
Recent conversation:
${a.length>0?a.map(e=>`${"user"===e.speaker?"User":"Agent"}: ${e.text}`).join("\n"):"No prior conversation yet."}

Newest preferences transcript:
${t||"No specific preferences given."}

Cumulative preference direction:
${o||"No specific preferences given."}

Respond with strict JSON only. Use this shape exactly:
{
  "selectedStyle": "one of the available style names exactly",
  "mashupName": "short memorable demo name",
  "agentReply": "2-3 sentence stylist response in a warm, decisive tone",
  "preferencesSummary": "one sentence summary of what the user asked for",
  "overlay": {
    "silhouette": "bob" | "curtain" | "shag",
    "colorName": "soft-black" | "espresso" | "chestnut" | "copper" | "golden-blonde",
    "part": "center" | "side",
    "texture": "sleek" | "airy" | "piecey" | "wavy",
    "volume": "low" | "medium" | "high",
    "fringe": "none" | "curtain" | "wispy" | "full",
    "length": "short" | "medium" | "long"
  }
}
`.trim();try{let e=await u.models.generateContent({model:l,contents:m,config:{responseMimeType:"application/json",temperature:.7}});return function(e,t,r,n,a=[]){let o=s(t,r,n,a);if(!e||"object"!=typeof e)return o;let i=r.map(e=>e.name),l="string"==typeof e.selectedStyle&&i.includes(e.selectedStyle)?e.selectedStyle:o.selectedStyle,c=e.overlay&&"object"==typeof e.overlay?e.overlay:{};return{selectedStyle:l,mashupName:"string"==typeof e.mashupName&&e.mashupName.trim()?e.mashupName.trim():o.mashupName,agentReply:"string"==typeof e.agentReply&&e.agentReply.trim()?e.agentReply.trim():o.agentReply,preferencesSummary:"string"==typeof e.preferencesSummary&&e.preferencesSummary.trim()?e.preferencesSummary.trim():o.preferencesSummary,overlay:{silhouette:v(c.silhouette,f)?c.silhouette:o.overlay.silhouette,colorName:v(c.colorName,p)?c.colorName:o.overlay.colorName,part:v(c.part,h)?c.part:o.overlay.part,texture:v(c.texture,y)?c.texture:o.overlay.texture,volume:v(c.volume,d)?c.volume:o.overlay.volume,fringe:v(c.fringe,g)?c.fringe:o.overlay.fringe,length:v(c.length,w)?c.length:o.overlay.length,fit:o.overlay.fit}}}(k(e.text||""),o,r,n,a)}catch(e){return console.error("Failed to generate style mashup:",e),c}}async function $(e){let t=function(){let e=b();if(!e)throw Error("GEMINI_API_KEY is not configured for image generation.");return e}(),r=e.mashupName?.trim()||e.selectedStyle.trim(),a=e.preferencesSummary?.trim()||e.preferences?.trim()||"polished, flattering, salon-ready",o=e.stylistReply?.trim()||`Build an elevated salon board for ${e.selectedStyle}.`,i=e.faceProfile?`${e.faceProfile.faceShape} face shape, ${e.faceProfile.hairTexture} texture, ${e.faceProfile.skinTone} tone.`:"No face profile was supplied.",s=`
Create a polished hairstyle style board image for a salon consultation.

Primary hairstyle: ${e.selectedStyle}
Board title direction: ${r}
User preference summary: ${a}
Stylist brief: ${o}
Face and texture notes: ${i}

Requirements:
- photorealistic beauty editorial result
- shoulders-up framing
- hairstyle is the hero, with clear silhouette and texture
- luxury salon campaign lighting
- clean background
- no text, no watermark, no split panels, no collage
- keep the look wearable and stylist-ready
- if a reference selfie is provided, preserve the person's identity while changing only the hairstyle
`.trim(),l=x(e.selfie?.imageBytes,e.selfie?.mimeType),u=await t.models.generateContent({model:c,contents:[{role:"user",parts:[{text:s},...l?[{inlineData:l}]:[]]}],config:{responseModalities:[n.mM.IMAGE,n.mM.TEXT],temperature:.8}}),m=function(e){for(let t of e.candidates?.[0]?.content?.parts||[]){let e=t.inlineData;if(e?.data&&e.mimeType?.startsWith("image/"))return{data:e.data,mimeType:e.mimeType}}return null}(u);if(!m)throw Error(u.text?.trim()||"Gemini did not return an image for the style board request.");return{imageDataUrl:`data:${m.mimeType};base64,${m.data}`,mimeType:m.mimeType,title:r,brief:a,prompt:s,model:c,modelText:u.text?.trim()||""}}}};