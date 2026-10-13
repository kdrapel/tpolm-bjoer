import {ModuleTrackerView} from './tracker-view.mjs?v=tracker-v10';
const $=id=>document.getElementById(id),screen=$('screen').getContext('2d'),back=$('background').getContext('2d');
const tracker=new ModuleTrackerView($('tracker'),$('tracker-title'));
const seed=window.BJOER_LIVE_INITIAL_STATE;delete window.BJOER_LIVE_INITIAL_STATE;
let index=null,background=null,graphics=null,music=null,context=null,gain=null,nodes=[],frames=[],request=0,pending=false,done=false,playing=false,paused=false,started=false,origin=0,startAt=0,scheduled=0,lastTime=0;
const duration=170,image=screen.createImageData(320,240),backImage=back.createImageData(320,200);
for(let i=3;i<image.data.length;i+=4)image.data[i]=255;
let hudTimer,scrubbing=false;
let audioIndex=null;const checkpointCache=new Map(),audioCheckpointCache=new Map();
let statsEnabled=false,statsDirty=false,statsUpdated=0,displayedFrames=[];
function resetStats(){displayedFrames=[];statsDirty=false;statsUpdated=0;$('stats').textContent='FPS: —';}
function updateStats(now){
 if(!statsEnabled)return;
 $('stats').hidden=!playing;$('nerd-panel').hidden=!playing;
 if(!playing||paused||!started){displayedFrames=[];statsDirty=false;$('stats').textContent=paused?'FPS: 0 (paused)':'FPS: —';return;}
 // Count at most one new picture per browser paint, never repeated RAF callbacks
 // or intermediate pictures overwritten in the same callback.
 if(statsDirty)displayedFrames.push(now);statsDirty=false;
 while(displayedFrames.length&&displayedFrames[0]<=now-1000)displayedFrames.shift();
 if(now-statsUpdated>=250){$('stats').textContent='FPS: '+displayedFrames.length;statsUpdated=now;}
}
$('stats-toggle').onchange=()=>{statsEnabled=$('stats-toggle').checked;$('stats').hidden=!statsEnabled||!playing;$('nerd-panel').hidden=!statsEnabled||!playing;resetStats();};
function revealControls(){if(document.fullscreenElement)return;$('hud').classList.add('visible');clearTimeout(hudTimer);hudTimer=setTimeout(()=>$('hud').classList.remove('visible'),2500);}
const fmt=t=>Math.floor(t/60)+':'+String(Math.floor(t%60)).padStart(2,'0');
function initial(){const s=structuredClone(seed);s.memory=Uint8Array.from(atob(s.memory_base64),c=>c.charCodeAt(0)).buffer;delete s.memory_base64;return s;}
function worker(){return new Worker('app/runtime-worker.js?v=tracker-v10');}
function landing(){background?.terminate();background=worker();background.onmessage=({data})=>{if(data.type!=='background')return;const p=new Uint8Array(data.pixels),out=backImage.data;for(let i=0;i<p.length;i++){const color=data.palette[p[i]];for(let c=0;c<3;c++)out[4*i+c]=(color[c]<<2)|(color[c]>>4);out[4*i+3]=255;}back.putImageData(backImage,0,0);};const s=initial();background.postMessage({...s,kind:'background'},[s.memory]);}
async function cachedCheckpoint(cache,key,read){if(!cache.has(key)){cache.set(key,read().catch(error=>{cache.delete(key);throw error;}));if(cache.size>3)cache.delete(cache.keys().next().value);}return structuredClone(await cache.get(key));}
async function audioSeed(seconds){if(context.sampleRate!==48000)return null;audioIndex??=fetch('data/audio-seek-index.json').then(r=>{if(!r.ok)throw Error('Missing audio seek index');return r.json();});const table=await audioIndex,cp=table.checkpoints.findLast(c=>c.seconds<=seconds);if(!cp)return null;return cachedCheckpoint(audioCheckpointCache,cp.seconds,async()=>{const [meta,res]=await Promise.all([fetch('data/'+cp.metadata).then(r=>r.json()),fetch('data/'+cp.memory)]);if(!res.ok)throw Error('Missing audio checkpoint');meta.state.memory=await new Response(res.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();return meta;});}
async function seekSeed(seconds){const cp=index.checkpoints.findLast(c=>c.tick*index.period/1193182<=seconds);if(!cp)return initial();return cachedCheckpoint(checkpointCache,cp.tick,async()=>{const [meta,response]=await Promise.all([fetch('data/'+cp.metadata).then(r=>{if(!r.ok)throw Error('Missing seek metadata');return r.json();}),fetch('data/'+cp.memory)]);if(!response.ok)throw Error('Missing seek memory');meta.memory=await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();return meta;});}
function stop(showGate=true){if(showGate)scrubbing=false;$('loading').hidden=true;tracker.clear();resetStats();$('stats').hidden=true;$('nerd-panel').hidden=true;request++;graphics?.terminate();music?.terminate();graphics=music=null;for(const n of nodes){try{n.stop();n.disconnect();}catch{}}nodes=[];context?.suspend();frames=[];playing=false;started=false;paused=false;$('pause').textContent='Pause';if(showGate){$('gate').hidden=false;$('hud').hidden=true;$('status').textContent='';landing();}}
function draw(frame){const p=new Uint8Array(frame.pixels),out=image.data;for(let i=0;i<p.length;i++){const color=frame.palette[p[i]],offset=4*(i+320*20);for(let c=0;c<3;c++)out[offset+c]=(color[c]<<2)|(color[c]>>4);out[offset+3]=255;}screen.putImageData(image,0,0);lastTime=frame.seconds;}
function ask(){if(graphics&&!pending&&!done&&frames.length<2){pending=true;graphics.postMessage({kind:'next',seconds:started?Math.max(startAt,startAt+context.currentTime-origin):startAt});}}
function ready(){if(!started&&scheduled&&frames.length){started=true;$('loading').hidden=true;draw(frames.shift());ask();if(!paused)context.resume();}}
async function play(seconds=0){
 stop(false);const id=request;startAt=Math.min(duration-0.2,Math.max(0,seconds));lastTime=startAt;scheduled=0;origin=0;pending=false;done=false;
 background?.terminate();background=null;$('gate').hidden=true;$('hud').hidden=false;$('loading').hidden=false;$('status').textContent='';revealControls();
 try{
  context??=new AudioContext({sampleRate:48000});await context.resume();await context.suspend();if(id!==request)return;
  if(!gain){gain=context.createGain();gain.connect(context.destination);}gain.gain.value=Number($('volume').value);
  const [s,response,audioCheckpoint]=await Promise.all([seekSeed(startAt),fetch('data/bjoer.mxm'),audioSeed(startAt)]);if(!response.ok)throw Error('Missing MXM module');const module=await response.arrayBuffer();if(id!==request)return;
  tracker.setModule(new Uint8Array(module));playing=true;graphics=worker();music=worker();
  const fail=message=>{if(id!==request)return;stop();$('status').textContent='Execution stopped: '+message;};
  graphics.onerror=e=>fail(e.message);music.onerror=e=>fail(e.message);
  graphics.onmessage=({data})=>{if(id!==request)return;pending=false;if(data.type==='error'){fail(data.message);return;}if(data.type==='complete'){done=true;return;}if(data.type==='frame'){frames.push(data);ready();ask();}};
  music.onmessage=({data})=>{if(id!==request)return;if(data.type==='error'){fail(data.message);return;}if(data.type==='audio'){
   tracker.append(data.trackerRows);if(!scheduled)origin=context.currentTime+0.2;
   const left=new Float32Array(data.left),right=new Float32Array(data.right),buffer=context.createBuffer(2,left.length,context.sampleRate);buffer.copyToChannel(left,0);buffer.copyToChannel(right,1);
   const source=context.createBufferSource();source.buffer=buffer;source.connect(gain);nodes.push(source);source.onended=()=>{source.disconnect();nodes=nodes.filter(n=>n!==source);};source.start(origin+scheduled/context.sampleRate);scheduled+=left.length;ready();
  }if(data.type==='audio-ready'){music.terminate();music=null;}};
  graphics.postMessage({...s,frame_ticks:index.frame_ticks??8,kind:'graphics',start:startAt,end:duration},[s.memory]);
  const a=initial();music.postMessage({...a,kind:'audio',module,audioCheckpoint,sampleRate:context.sampleRate,start:startAt,end:duration},audioCheckpoint?[a.memory,module,audioCheckpoint.state.memory]:[a.memory,module]);
 }catch(error){if(id===request){stop();$('status').textContent='Unable to start: '+error.message;}}
}
function animate(){requestAnimationFrame(animate);if(!playing||!started){updateStats(performance.now());return;}const time=Math.max(startAt,startAt+context.currentTime-origin);
 while(frames.length&&frames[0].seconds<=time+0.025){draw(frames.shift());statsDirty=true;ask();}
 updateStats(performance.now());if(statsEnabled)tracker.draw(time,performance.now());
 if(!scrubbing){$('timeline').value=Math.min(duration,time);$('time').textContent=fmt(time)+' / '+fmt(duration);}
 if(time>=duration){stop();return;}
 if(paused)return;
 // Graphics work must never interrupt the music clock. Only explicit pause,
 // stop and initial preparation suspend audio.
 if(context.state==='suspended')context.resume();
}
function toggle(){if(!playing){play(0);return;}paused=!paused;$('pause').textContent=paused?'Resume':'Pause';if(paused)context.suspend();}
$('start').onclick=()=>play(0);$('pause').onclick=toggle;$('stop').onclick=()=>stop();$('timeline').oninput=()=>{scrubbing=true;$('time').textContent=fmt(Number($('timeline').value))+' / '+fmt(duration);};$('timeline').onchange=()=>{scrubbing=false;play(Number($('timeline').value));};$('timeline').addEventListener('pointercancel',()=>{scrubbing=false;});$('backward').onclick=()=>play(Math.max(0,Number($('timeline').value)-15));$('forward').onclick=()=>play(Math.min(duration-0.2,Number($('timeline').value)+15));$('volume').oninput=()=>{if(gain)gain.gain.value=Number($('volume').value);};
async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await $('shell').requestFullscreen();}catch{$('status').textContent='Fullscreen is unavailable in this browser.';}}$('fullscreen').onclick=fullscreen;
$('shell').addEventListener('pointermove',revealControls);$('shell').addEventListener('pointerdown',revealControls);
addEventListener('keydown',e=>{if(e.key.toLowerCase()==='f'&&!e.ctrlKey&&!e.metaKey&&!e.altKey){e.preventDefault();if(!e.repeat)fullscreen();return;}if(e.target instanceof HTMLInputElement)return;if(e.code==='Space'){e.preventDefault();toggle();}if(e.key==='Escape'&&playing)stop();if(playing&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();play(Number($('timeline').value)+(e.key==='ArrowLeft'?-15:15));}});
try{const response=await fetch('data/seek-index.json');if(!response.ok)throw Error('Missing seek index');index=await response.json();$('start').disabled=false;$('start').textContent='Start intro';$('status').textContent='';landing();}catch(error){$('status').textContent=error.message;}
animate();
