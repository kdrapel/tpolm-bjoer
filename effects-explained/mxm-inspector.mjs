import {decodeModule,noteName} from '../app/tracker-view.mjs';
const select=document.querySelector('#pattern-select'),summary=document.querySelector('#pattern-summary'),output=document.querySelector('#pattern');
const hex=n=>n.toString(16).toUpperCase().padStart(2,'0');
try{
 const response=await fetch('../data/bjoer.mxm');if(!response.ok)throw Error('Module download failed');
 const module=decodeModule(new Uint8Array(await response.arrayBuffer()));
 module.patterns.forEach((_,i)=>{const option=document.createElement('option');option.value=i;option.textContent=hex(i);select.append(option);});
 function draw(){const number=+select.value,pattern=module.patterns[number];summary.textContent=`Pattern ${hex(number)} · ${pattern.length} rows · ${module.channels} channels`;output.textContent='ROW  '+Array.from({length:module.channels},(_,i)=>`CHANNEL ${hex(i+1)}`.padEnd(19)).join('')+'\n'+pattern.map((row,i)=>hex(i)+'   '+row.map(cell=>!cell?'... .. .. .....'.padEnd(19):(noteName(cell.note)+' '+(cell.instrument?hex(cell.instrument):'..')+' '+(cell.volume?hex(cell.volume):'..')+' '+(cell.effect||cell.parameter?hex(cell.effect)+' '+hex(cell.parameter):'.. ..')).padEnd(19)).join('')).join('\n');}
 select.disabled=false;select.addEventListener('change',draw);draw();
}catch(error){summary.textContent='Unable to inspect module: '+error.message;}
