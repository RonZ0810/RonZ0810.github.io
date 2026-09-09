import * as THREE from 'three';

// Original, locally generated surface and desktop artwork. No remote runtime assets.
export function desktopTexture(makeTexture, mobile) {
  return makeTexture((c, w, h) => {
    const sky = c.createLinearGradient(0, 0, w, h);
    sky.addColorStop(0, '#061a41'); sky.addColorStop(.55, '#095fc3'); sky.addColorStop(1, '#081938');
    c.fillStyle = sky; c.fillRect(0, 0, w, h);
    c.save(); c.translate(w * .60, h * .49);
    for (let i = 0; i < 19; i++) {
      c.save(); c.rotate(-.45 + i * .075);
      const g = c.createLinearGradient(-w * .2, 0, w * .2, 0);
      g.addColorStop(0, '#063e93'); g.addColorStop(.48, '#7bd1ff'); g.addColorStop(.58, '#2487e1'); g.addColorStop(1, '#073873');
      c.strokeStyle = g; c.lineWidth = w * .033;
      c.beginPath(); c.ellipse(0, 0, w * (.19 + i * .001), h * .25, 0, 0, Math.PI * 2); c.stroke(); c.restore();
    }
    c.restore();
    const icon = (x, y, kind, size) => {
      c.save(); c.translate(x, y); c.scale(size / 48, size / 48);
      if (kind === 'chrome') {
        ['#ea4335', '#fbbc05', '#34a853'].forEach((color, i) => { c.fillStyle = color; c.beginPath(); c.moveTo(24,24); c.arc(24,24,22, i * 2.094 - 1.57, (i+1)*2.094 - 1.57); c.closePath(); c.fill(); });
        c.fillStyle = '#fff'; c.beginPath(); c.arc(24,24,10,0,7); c.fill(); c.fillStyle = '#4285f4'; c.beginPath(); c.arc(24,24,8,0,7); c.fill();
      } else if (kind === 'code') {
        c.fillStyle = '#23a9f2'; c.beginPath(); c.moveTo(34,3); c.lineTo(46,8); c.lineTo(46,40); c.lineTo(34,45); c.lineTo(10,24); c.lineTo(3,30); c.lineTo(0,26); c.lineTo(10,17); c.lineTo(34,36); c.closePath(); c.fill();
        c.beginPath(); c.moveTo(34,3); c.lineTo(8,27); c.lineTo(3,21); c.lineTo(34,12); c.fill();
      } else if (kind === 'openai') {
        c.fillStyle = '#f5f5f5'; c.beginPath(); c.roundRect(1,1,46,46,10); c.fill(); c.strokeStyle = '#172524'; c.lineWidth = 2.5;
        for (let i=0;i<6;i++) { c.save(); c.translate(24,24); c.rotate(i*Math.PI/3); c.beginPath(); c.roundRect(-7,-16,19,24,8); c.stroke(); c.restore(); }
      } else if (kind === 'bin') {
        c.fillStyle = '#dcecf4'; c.fillRect(10,10,28,33); c.fillStyle = '#8fb1c8'; c.fillRect(7,7,34,4); c.font='22px sans-serif'; c.fillText('♻',13,34);
      } else { c.fillStyle='#1a80e8'; for(let i=0;i<4;i++) c.fillRect(6+(i%2)*20,6+Math.floor(i/2)*20,17,17); }
      c.restore();
    };
    const scale = w / 1920;
    [['bin','Recycle Bin'],['code','Visual Studio Code'],['openai','OpenAI'],['chrome','Google Chrome']].forEach(([kind,label],i) => {
      const y = (35+i*125)*scale; icon(45*scale,y,kind,48*scale);
      c.textAlign='center'; c.font=`${18*scale}px Arial`; c.shadowColor='#000'; c.shadowBlur=3*scale; c.fillStyle='#fff'; c.fillText(label,70*scale,y+72*scale); c.shadowBlur=0;
    });
    c.fillStyle='rgba(222,237,253,.94)'; c.fillRect(0,h-58*scale,w,58*scale);
    ['start','code','openai','chrome'].forEach((kind,i)=>icon(w/2-103*scale+i*55*scale,h-46*scale,kind,34*scale));
    c.fillStyle='#20364e'; c.textAlign='right'; c.font=`${17*scale}px Arial`; c.fillText('10:24 AM',w-22*scale,h-32*scale); c.fillText('9/9/2026',w-22*scale,h-10*scale);
    c.textAlign='left'; c.fillText('⌃   ◉  ▰',w-195*scale,h-21*scale);
  }, mobile ? 1024 : 1920, mobile ? 576 : 1080);
}

export function addOfficeDetails(owner, room, m, { box, cylinder, rod, group, canvasTexture, material }) {
  const rubber = material('#222522', { roughness:.91 }), ivory = material('#edeae1', { roughness:.42 });
  const noise = canvasTexture((c,w,h) => { let seed=12; for(let y=0;y<h;y++) for(let x=0;x<w;x++) { seed=(seed*1664525+1013904223)>>>0; const v=190+(seed%40); c.fillStyle=`rgb(${v},${v},${v})`; c.fillRect(x,y,1,1); } },128,128);
  noise.colorSpace=THREE.NoColorSpace; noise.wrapS=noise.wrapT=THREE.RepeatWrapping; noise.repeat.set(24,16);
  // Copies retain these fine plaster details when assigned to the enclosing walls.
  room.traverse(o=> { if(o.isMesh && o.material?.color?.equals(m.white.color)) { o.material.bumpMap=noise; o.material.bumpScale=.0012; o.material.needsUpdate=true; } });
  m.dark.bumpMap=noise; m.dark.bumpScale=.0003;
  m.fabric.bumpMap=m.fabric.map; m.fabric.bumpScale=.002; m.fabric.map.wrapS=m.fabric.map.wrapT=THREE.RepeatWrapping; m.fabric.map.repeat.set(8,6);
  const groundMap=canvasTexture((c,w,h)=> {
    c.fillStyle='#778663';c.fillRect(0,0,w,h);let seed=63;
    for(let i=0;i<18000;i++){seed=(seed*1664525+1013904223)>>>0;const x=seed%w;seed=(seed*1664525+1013904223)>>>0;const y=seed%h;c.fillStyle=['#879367','#697853','#78845c','#938a68'][i%4];c.fillRect(x,y,1,3);}
  },512,512);
  groundMap.wrapS=groundMap.wrapT=THREE.RepeatWrapping;groundMap.repeat.set(14,18);
  owner.scene.getObjectByName('window-garden')?.traverse(o=> {if(o.isMesh && o.geometry.parameters?.width===28){o.material.map=groundMap;o.material.bumpMap=groundMap;o.material.bumpScale=.015;o.material.needsUpdate=true;}});
  const screw = (parent,p,axis='z') => {
    const head=cylinder(parent,.004,.004,.002,p,m.metal); head.rotation.x=axis==='z'?Math.PI/2:0; head.rotation.z=axis==='x'?Math.PI/2:0;
    return head;
  };
  const cable = (points,r=.0035,mat=rubber) => {
    const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)),false,'centripetal');
    const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,Math.max(24,points.length*8),r,6,false),mat); mesh.castShadow=true; room.add(mesh); return mesh;
  };
  // Three sealed casement modules with a separate exterior insect screen.
  const meshMap=canvasTexture((c,w,h)=> { c.clearRect(0,0,w,h); c.strokeStyle='rgba(35,40,36,.55)'; c.lineWidth=1; for(let i=0;i<w;i+=8) {c.beginPath();c.moveTo(i,0);c.lineTo(i,h);c.stroke();c.beginPath();c.moveTo(0,i);c.lineTo(w,i);c.stroke();} },128,128);
  meshMap.wrapS=meshMap.wrapT=THREE.RepeatWrapping; meshMap.repeat.set(12,24); meshMap.anisotropy=4;
  const screenMat=new THREE.MeshBasicMaterial({map:meshMap,transparent:true,opacity:.34,depthWrite:false,side:THREE.DoubleSide});
  const paneMat=new THREE.MeshPhysicalMaterial({color:'#eff7fa',transparent:true,opacity:.13,roughness:.06,metalness:.12,depthWrite:false});
  for(const z of [-1.22,-.02,1.18]) {
    const frame=group(room,[-3.37,1.67,z]); frame.name='window-hardware';
    for(const edge of [-.565,.565]) {
      box(frame,[.09,2.19,.032],[0,0,edge],ivory,.003);
      box(frame,[.013,2.13,.012],[.051,0,edge*.96],rubber,.001);
      for(const y of [-.93,.93]) screw(frame,[.05,y,edge],'x');
    }
    for(const y of [-1.08,1.08]) {box(frame,[.09,.032,1.16],[0,y,0],ivory,.003);box(frame,[.012,.01,1.09],[.051,y*.974,0],rubber,.001);}
    box(frame,[.012,2.1,1.09],[-.025,0,0],paneMat,0);
    const net=new THREE.Mesh(new THREE.PlaneGeometry(1.1,2.1),screenMat); net.rotation.y=Math.PI/2; net.position.x=-.11; frame.add(net);
    box(frame,[.025,.1,.034],[.069,-.12,.49],m.metal,.005);
    box(frame,[.035,.105,.021],[.095,-.16,.49],ivory,.008);
    for(const y of [-.65,.65]) cylinder(frame,.012,.012,.1,[.035,y,-.54],m.metal);
  }
  // Ports and connectors on the back of the display.
  box(room,[.32,.24,.035],[.08,1.31,-.708],rubber,.015);
  for(const x of [-.04,.04,.12]) box(room,[.028,.014,.007],[x,1.22,-.73],m.metal,.001);
  box(room,[.008,.003,.003],[.55,1.025,-.634],material('#cfedce',{emissive:'#80bc8d',emissiveIntensity:.8}),.001);
  const pc=group(room,[.64,.025,-.71]); pc.name='desktop-computer';
  box(pc,[.23,.43,.30],[0,.215,0],m.dark,.012);
  for(let i=0;i<15;i++) box(pc,[.18,.004,.002],[0,.09+i*.016,.151],rubber,.001);
  cylinder(pc,.012,.012,.003,[.065,.395,.152],m.metal).rotation.x=Math.PI/2;
  for(const x of [-.06,-.015]) box(pc,[.026,.009,.004],[x,.39,.153],rubber,.001);
  for(const x of [-.085,.085]) for(const z of [-.11,.11]) box(pc,[.027,.025,.03],[x,-.01,z],rubber,.004);
  const strip=group(room,[-.75,.65,-.83]); strip.name='power-strip';
  box(strip,[.59,.042,.086],[0,0,0],ivory,.012);
  for(let i=0;i<5;i++) {
    const x=-.23+i*.10; box(strip,[.065,.002,.061],[x,.022,0],material('#d4d0c6'),.006);
    for(const dx of [-.012,.012]) box(strip,[.004,.002,.016],[x+dx,.024,-.004],rubber,.001);
    cylinder(strip,.003,.003,.002,[x,.024,.017],rubber);
    if(i<4) box(strip,[.04,.035,.044],[x,.04,0],rubber,.006);
  }
  box(strip,[.026,.006,.05],[.267,.024,0],material('#b55137',{emissive:'#d35b2c',emissiveIntensity:.6}),.004);
  for(const x of [-.98,-.53]) box(room,[.014,.062,.11],[x,.697,-.83],m.dark,.002);
  for(const [x,z] of [[.38,-.84],[-.25,-.88],[-1.60,-.86]]) {
    cylinder(room,.041,.041,.004,[x,.815,z],m.metal);
    cylinder(room,.035,.035,.005,[x,.818,z],rubber);
  }
  for(const [x,y,w] of [[.60,.34,.031],[.66,.30,.018],[.70,.30,.018]]) box(room,[w,.013,.038],[x,y,-.875],rubber,.002);
  // Keyboard / mouse to USB ports on the computer, monitor display to its rear.
  cable([[.10,.84,-.155],[.14,.84,-.38],[.25,.84,-.66],[.38,.83,-.84],[.38,.74,-.84],[.66,.3,-.89]],.002);
  cable([[.6,.84,-.135],[.72,.84,-.3],[.58,.84,-.65],[.40,.83,-.84],[.40,.74,-.84],[.70,.3,-.89]],.002);
  cable([[.04,1.22,-.737],[.04,1.02,-.80],[.19,.87,-.84],[.36,.83,-.84],[.36,.74,-.84],[.60,.34,-.89]],.003);
  cable([[-.04,1.22,-.737],[-.12,1.02,-.80],[-.23,.86,-.86],[-.25,.83,-.88],[-.25,.74,-.88],[-.98,.69,-.83]]);
  cable([[-1.47,.84,-.77],[-1.57,.84,-.82],[-1.6,.83,-.86],[-1.6,.73,-.86],[-1.4,.61,-.99],[-.88,.69,-.83]]);
  cable([[.64,.19,-.865],[.56,.15,-1.01],[.13,.27,-1.02],[-.3,.6,-1.01],[-.78,.69,-.83]]);
  // Camera battery charger lives on the desk beside the power source.
  box(room,[.095,.03,.075],[-.58,.837,-.74],rubber,.006);
  box(room,[.05,.026,.037],[-.58,.863,-.735],m.dark,.003);
  box(room,[.005,.002,.003],[-.61,.854,-.71],material('#78ba68',{emissive:'#78ba68',emissiveIntensity:.7}),.001);
  cable([[-.58,.85,-.78],[-.44,.85,-.82],[-.27,.83,-.88],[-.27,.74,-.88],[-.68,.69,-.83]],.002);
  // Strip supply follows the rear leg and wall edge, never crossing the aisle.
  cable([[-1.055,.65,-.83],[-1.49,.60,-.83],[-1.57,.16,-.855],[-1.61,.055,-1.02],[-1.65,.04,-2.20],[-1.45,.04,-2.29],[-1.15,.07,-2.30],[-1.12,.32,-2.29]],.005);
  const outlet=group(room,[-1.12,.32,-2.363]); outlet.name='wall-outlet';
  box(outlet,[.075,.12,.014],[0,0,0],ivory,.007);
  for(const y of [-.026,.027]) {box(outlet,[.045,.04,.005],[0,y,.01],ivory,.009);for(const x of [-.011,.011]) box(outlet,[.004,.014,.002],[x,y,.014],rubber,.001);}
  box(outlet,[.044,.036,.049],[0,0,.037],rubber,.008); screw(outlet,[0,.052,.009]);
  // Tangible paper business card; it opens the existing contact dialog.
  const card=group(room,[-.48,.82,.095]); card.rotation.x=-Math.PI/2; card.rotation.z=.13;
  box(card,[.19,.105,.002],[0,0,0],m.paper,.001);
  const cardMap=canvasTexture((c,w,h)=>{c.fillStyle='#eee9dd';c.fillRect(0,0,w,h);c.fillStyle='#263b38';c.font='48px sans-serif';c.fillText('RONALD',30,85);c.font='24px sans-serif';c.fillText('LET’S CONNECT',30,143);c.fillStyle='#aa6845';c.fillRect(30,178,95,3);},512,280);
  const cardFace=new THREE.Mesh(new THREE.PlaneGeometry(.185,.1),material('#fff',{map:cardMap})); cardFace.position.z=.0015;card.add(cardFace);
  owner.registerClickable(card,{type:'contact',label:'Contact · the business card'});
  // Desk joinery, shelf fixings, notebook elastic, pencil, and precise key legends.
  for(const x of [-1.54,.84]) for(const z of [-.82,.02]) {box(room,[.10,.06,.10],[x,.70,z],m.dark,.004);screw(room,[x,.665,z],'y');}
  for(const y of [.12,.73,1.36,2.01]) for(const x of [-2.91,-1.39]) screw(room,[x,y,-1.60]);
  for(let i=0;i<7;i++) {const x=-2.73+i*.155, height=.31+(i%3)*.045;box(room,[.077,height-.018,.003],[x,1.40+height/2,-1.724],m.paper,.001);}
  // Frame glazing, inset mat borders, and clean rug binding catch grazing light.
  for(const [x,y,w,h] of [[1.55,1.88,1.04,1.2],[.12,1.88,1.02,1.2]]) {
    box(room,[w-.11,h-.11,.002],[x,y,-2.288],new THREE.MeshPhysicalMaterial({color:'#fff',transparent:true,opacity:.065,roughness:.08,metalness:.1,depthWrite:false}),0);
    for(const dx of [-w/2+.035,w/2-.035])box(room,[.009,h-.05,.006],[x+dx,y,-2.29],m.dark,.001);
  }
  for(const x of [-2.08,1.38]) box(room,[.017,.003,2.76],[x,.035,.35],m.fabric,.002);
  for(const z of [-1.035,1.735])box(room,[3.48,.003,.017],[-.35,.035,z],m.fabric,.002);
  cable([[-1.105,.8685,-.105],[-1.105,.8685,.19]],.0025,rubber);
  rod(room,[-.78,.831,.20],[-.48,.831,.23],.003,material('#b99957'));
  const legends=canvasTexture((c,w,h)=> {c.clearRect(0,0,w,h);c.fillStyle='#3c4240';c.font='15px monospace';const rows=['1234567890−=⌫','QWERTYUIOP[]','ASDFGHJKL;↵','ZXCVBNM ,./'];rows.forEach((r,y)=>[...r].forEach((v,x)=>c.fillText(v,10+x*36,18+y*40)));},512,160);
  const keys=new THREE.Mesh(new THREE.PlaneGeometry(.59,.185),new THREE.MeshBasicMaterial({map:legends,transparent:true,depthWrite:false}));keys.rotation.x=-Math.PI/2;keys.position.set(.1,.848,-.06);room.add(keys);
  box(room,[.001,.001,.067],[.60,.847,-.08],rubber,.0003);
  cylinder(room,.007,.007,.012,[.6,.845,-.10],rubber).rotation.z=Math.PI/2;
  // Floor joints give the timber a consistent plank scale.
  const seamMaterial=material('#9a8d79');
  for(let z=-2.1;z<2.4;z+=.3) box(room,[6.76,.001,.0015],[0,.011,z],seamMaterial,0);
  for(let row=0;row<15;row++) for(let x=-3.1+(row%3)*.6;x<3.3;x+=1.8) box(room,[.0015,.001,.298],[x,.011,-2.1+row*.3+.15],seamMaterial,0);
  addFan();
  function addFan() {
    const fan=group(room,[0,3.09,-.4]); fan.name='ceiling-fan';
    cylinder(fan,.09,.065,.06,[0,-.03,0],m.metal);cylinder(fan,.015,.015,.19,[0,-.145,0],m.dark);
    cylinder(fan,.105,.13,.12,[0,-.265,0],m.dark);
    owner.fanRotor=group(fan,[0,-.27,0]);
    for(let i=0;i<4;i++) {const root=group(owner.fanRotor);root.rotation.y=i*Math.PI/2;rod(root,[.075,0,0],[.23,0,0],.012,m.metal);const blade=box(root,[.53,.015,.115],[.44,0,0],m.oak,.025);blade.rotation.x=.16; blade.castShadow=false;}
    owner.ceilingMaterial=material('#fff2d5',{emissive:'#ffe4b2',emissiveIntensity:1.3,roughness:.35});
    const globe=new THREE.Mesh(new THREE.SphereGeometry(.105,32,16),owner.ceilingMaterial);globe.scale.y=.55;globe.position.y=-.35;fan.add(globe);
    owner.ceilingLight=new THREE.PointLight('#ffecd1',16,9,2);owner.ceilingLight.position.set(0,2.66,-.4);room.add(owner.ceilingLight);
    const plate=group(room,[2.36,1.30,2.307]);plate.rotation.y=Math.PI;plate.name='wall-switches';
    box(plate,[.15,.13,.012],[0,0,0],ivory,.007);owner.wallSwitches={};
    for(const [i,type] of ['ceiling','fan'].entries()) {
      const rocker=group(plate,[-.036+i*.072,0,.014]);box(rocker,[.045,.075,.011],[0,0,0],ivory,.004);rocker.rotation.x=-.12;
      owner.wallSwitches[type]=rocker;owner.registerClickable(rocker,{type,label:type==='fan'?'Toggle ceiling fan':'Toggle ceiling light'});
      const labelMap=canvasTexture((c,w,h)=>{c.fillStyle='#eeeae1';c.fillRect(0,0,w,h);c.fillStyle='#48524a';c.font='25px sans-serif';c.textAlign='center';c.fillText(type==='fan'?'FAN':'LIGHT',w/2,32);},128,48);
      const label=new THREE.Mesh(new THREE.PlaneGeometry(.051,.017),material('#fff',{map:labelMap}));label.position.set(-.036+i*.072,-.051,.008);plate.add(label);
    }
    for(const y of [-.055,.055]) screw(plate,[0,y,.008]);
  }
}
