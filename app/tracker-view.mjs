const names=['C-','C#','D-','D#','E-','F-','F#','G-','G#','A-','A#','B-'];
const hex=n=>n.toString(16).toUpperCase().padStart(2,'0');
export function decodeModule(bytes){
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 if(view.getUint32(0,true)!==0x004d584d)throw Error('Expected MXM');
 const channels=view.getUint32(12,true),count=view.getUint32(16,true),orders=Array.from(bytes.subarray(80,80+view.getUint32(4,true))),patterns=[];
 if(channels!==16)throw Error('Unsupported tracker channel count');
 for(let p=0;p<count;p++){
  let cursor=view.getUint32(0x350+p*4,true),rows=view.getUint32(cursor,true);cursor+=4;const pattern=[];
  for(let row=0;row<rows;row++){const tracks=Array.from({length:channels},()=>null);
   for(;;){const command=bytes[cursor++];if(!command)break;const channel=command&31;if(channel>=channels||cursor>=bytes.length)throw Error('Invalid MXM pattern');const cell={note:0,instrument:0,volume:0,effect:0,parameter:0};
    if(command&32){cell.note=bytes[cursor++];cell.instrument=bytes[cursor++];}
    if(command&64)cell.volume=bytes[cursor++];
    if(command&128){cell.effect=bytes[cursor++];cell.parameter=bytes[cursor++];}
    tracks[channel]=cell;
   }pattern.push(tracks);
  }patterns.push(pattern);
 }
 return {channels,orders,patterns};
}
export function noteName(note){if(!note)return '...';if(note===97)return 'OFF';const n=note-1;return names[n%12]+Math.floor(n/12);}
export class ModuleTrackerView{
 constructor(canvas,title){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.title=title;this.events=[];this.cursor=0;this.lastPaint=-Infinity;}
 setModule(bytes){if(!this.module)this.module=decodeModule(bytes);}
 clear(){this.events=[];this.cursor=0;this.lastPaint=-Infinity;this.title.textContent='bjoer.mxm · 16 channels';}
 append(events){for(const event of events??[]){const last=this.events.at(-1);if(!last||last.order!==event.order||last.row!==event.row)this.events.push(event);}}
 position(seconds){while(this.cursor+1<this.events.length&&this.events[this.cursor+1].seconds<=seconds)this.cursor++;while(this.cursor>0&&this.events[this.cursor].seconds>seconds)this.cursor--;return this.events[this.cursor];}
 draw(seconds,now){if(!this.module||!this.events.length||now-this.lastPaint<33)return;this.lastPaint=now;const event=this.position(seconds),next=this.events[this.cursor+1],progress=next?Math.max(0,Math.min(1,(seconds-event.seconds)/(next.seconds-event.seconds))):0;
  const {ctx,canvas,module}=this,width=canvas.width,height=canvas.height,left=30,column=(width-left)/module.channels,line=16,center=100;
  ctx.fillStyle='#10151deF';ctx.fillRect(0,0,width,height);ctx.font='10px monospace';ctx.textBaseline='middle';
  ctx.fillStyle='#7f8fa1';for(let ch=0;ch<module.channels;ch++)ctx.fillText(hex(ch+1),left+ch*column+3,10);
  ctx.fillStyle='#53677e55';ctx.fillRect(0,center-8,width,line);
  for(let ch=0;ch<module.channels;ch++){ctx.fillStyle='#40536a66';ctx.fillRect(left+ch*column,20,1,height-20);}
  for(let offset=-5;offset<=7;offset++){const e=this.events[this.cursor+offset];if(!e)continue;const y=center+(offset-progress)*line;if(y<26||y>height-6)continue;const pattern=module.patterns[module.orders[e.order]],row=pattern?.[e.row];if(!row)continue;
   ctx.fillStyle=offset===0?'#e2e9f0':'#6a7f96';ctx.fillText(hex(e.row),4,y);
   ctx.font='9px monospace';for(let ch=0;ch<module.channels;ch++){const cell=row[ch];ctx.fillStyle=cell?.note?(offset===0?'#f1f4f7':'#a9bdd0'):'#485a6c';ctx.fillText(noteName(cell?.note??0)+' '+(cell?.instrument?hex(cell.instrument):'..'),left+ch*column+3,y);}ctx.font='10px monospace';
  }
  this.title.textContent='bjoer.mxm · 16 channels · order '+hex(event.order)+' · pattern '+hex(module.orders[event.order])+' · row '+hex(event.row);
 }
}
