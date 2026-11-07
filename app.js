import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { gsap } from "gsap";

const viewport = document.getElementById("viewport");
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x17191e);

const camera = new THREE.PerspectiveCamera(55, viewport.clientWidth / viewport.clientHeight, 0.1, 100);
camera.position.set(7.5, 5.8, 8.5);

const renderer = new THREE.WebGLRenderer({ antialias:true, preserveDrawingBuffer:true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(viewport.clientWidth, viewport.clientHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
viewport.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0,2,0);
controls.enableDamping = true;
controls.minDistance = 4;
controls.maxDistance = 16;
controls.maxPolarAngle = Math.PI * .49;

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const objects = [];
let selected = null;
let dragging = false;
let dragOffset = new THREE.Vector3();
let mode = "move";
let snapEnabled = true;
let sunTime = "afternoon";
let cleaned = false;
let beforeSnapshot = null;
let xp = Number(localStorage.getItem("rc_xp") || 0);
let level = Number(localStorage.getItem("rc_level") || 1);
let history = [];
let future = [];
let currentRoom = "Living Room";
const roomParts = [];

const mats = {
  oak:new THREE.MeshStandardMaterial({color:0x9a633b,roughness:.72}),
  walnut:new THREE.MeshStandardMaterial({color:0x51321f,roughness:.68}),
  marble:new THREE.MeshStandardMaterial({color:0xe4e2dc,roughness:.28,metalness:.03}),
  blackMarble:new THREE.MeshStandardMaterial({color:0x26272a,roughness:.22}),
  fabric:new THREE.MeshStandardMaterial({color:0x8b8177,roughness:.92}),
  velvet:new THREE.MeshStandardMaterial({color:0x4f4b55,roughness:.8}),
  leather:new THREE.MeshStandardMaterial({color:0x6c4938,roughness:.6}),
  gold:new THREE.MeshStandardMaterial({color:0xc69b4a,metalness:.82,roughness:.22}),
  metal:new THREE.MeshStandardMaterial({color:0x4b5159,metalness:.9,roughness:.22}),
  glass:new THREE.MeshPhysicalMaterial({color:0xbfd9e6,transparent:true,opacity:.34,roughness:.08,transmission:.35}),
  white:new THREE.MeshStandardMaterial({color:0xe9e5dc,roughness:.55}),
  green:new THREE.MeshStandardMaterial({color:0x47734c,roughness:.88}),
  dark:new THREE.MeshStandardMaterial({color:0x202329,roughness:.5})
};

const catalog = {
  "Living Room":[["sofa","🛋️","Sofa"],["armchair","🪑","Armchair"],["table","🪵","Coffee Table"],["tv","📺","TV"],["rug","▧","Rug"],["lamp","💡","Floor Lamp"]],
  "Bedroom":[["bed","🛏️","Bed"],["bedside","🗄️","Bedside Table"],["wardrobe","🚪","Wardrobe"],["mirror","🪞","Mirror"],["lamp","💡","Lamp"]],
  "Study":[["desk","🖥️","Desk"],["chair","🪑","Office Chair"],["bookshelf","📚","Bookshelf"],["laptop","💻","Laptop"],["plant","🪴","Plant"]],
  "Decor":[["plant","🪴","Plant"],["books","📚","Books"],["vase","🏺","Vase"],["painting","🖼️","Painting"],["candle","🕯️","Candle"],["clock","🕘","Clock"],["cushion","🟫","Cushion"]]
};

function addLights(){
  scene.add(new THREE.HemisphereLight(0xfff4df,0x38404a,1.7));
  const sun = new THREE.DirectionalLight(0xffe5bd,3.0);
  sun.name="sun"; sun.position.set(5,9,4); sun.castShadow=true;
  sun.shadow.mapSize.set(2048,2048);
  sun.shadow.camera.left=-10; sun.shadow.camera.right=10; sun.shadow.camera.top=10; sun.shadow.camera.bottom=-10;
  scene.add(sun);
  const fill = new THREE.PointLight(0xffd4a4,1.2,12);
  fill.position.set(-2,4,1); fill.name="roomLight"; scene.add(fill);
}
addLights();

function box(w,h,d,material,x,y,z,name, cast=true){
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
  m.position.set(x,y,z); m.name=name; m.castShadow=cast; m.receiveShadow=true; scene.add(m); return m;
}
function cyl(r,h,material,x,y,z,name){
  const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,24),material);
  m.position.set(x,y,z); m.name=name; m.castShadow=true; m.receiveShadow=true; scene.add(m); return m;
}
function group(name){ const g=new THREE.Group(); g.name=name; g.userData={interactive:true}; scene.add(g); objects.push(g); return g; }

function roomBox(w,h,d,material,x,y,z,name,cast=false){
  const m=box(w,h,d,material,x,y,z,name,cast);
  roomParts.push(m);
  return m;
}
function clearRoomShell(){
  for(const part of roomParts){scene.remove(part);if(part.geometry)part.geometry.dispose();}
  roomParts.length=0;
}
function makeRoom(roomType="Living Room"){
  clearRoomShell();
  currentRoom=roomType;
  const wallColors={
    "Living Room":0xe9e2d6,"Bedroom":0xe8dfd5,"Kitchen":0xf0eee7,
    "Bathroom":0xd9e8eb,"Study":0xded9cc
  };
  const floorMats={
    "Living Room":mats.oak,
    "Bedroom":new THREE.MeshStandardMaterial({color:0xb8875d,roughness:.78}),
    "Kitchen":new THREE.MeshStandardMaterial({color:0xc8c3b9,roughness:.48}),
    "Bathroom":new THREE.MeshStandardMaterial({color:0xd9d9d4,roughness:.3}),
    "Study":new THREE.MeshStandardMaterial({color:0x866344,roughness:.72})
  };
  const wallMat=new THREE.MeshStandardMaterial({color:wallColors[roomType]||wallColors["Living Room"],roughness:roomType==="Bathroom"?.45:.82});
  const floorName=roomType==="Bathroom"?"Bathroom Tile Floor":"Wooden Floor";
  roomBox(14,.18,12,floorMats[roomType]||mats.oak,0,-.09,0,floorName,false);
  roomBox(14,6,.18,wallMat,0,3,-6,"Back Wall",false);
  roomBox(.18,6,12,wallMat,-7,3,0,"Left Wall",false);
  roomBox(.18,6,12,wallMat,7,3,0,"Right Wall",false);
  roomBox(14,.18,12,wallMat,0,6,0,"Ceiling",false);
  roomBox(14,.16,.16,new THREE.MeshStandardMaterial({color:0xf7f3eb}),0,.08,-5.82,"Baseboard",false);

  // Room-specific architectural details and built-in fixtures.
  if(roomType==="Bathroom"){
    const tile=new THREE.MeshStandardMaterial({color:0xb9d1d5,roughness:.35});
    // tiled shower zone on the back-left side
    roomBox(3.1,3.7,.08,tile,-3.95,3.0,-5.78,"Shower Tile Feature",false);
    roomBox(2.7,3.5,.07,mats.glass,-3.95,1.85,-4.55,"Shower Glass Panel",false);
    roomBox(2.9,.12,2.1,new THREE.MeshStandardMaterial({color:0xf5f3ee,roughness:.22}),-3.95,.18,-4.75,"Shower Base",false);
    roomBox(.09,2.5,.09,mats.metal,-5.25,1.45,-4.55,"Shower Frame L",false);
    roomBox(.09,2.5,.09,mats.metal,-2.65,1.45,-4.55,"Shower Frame R",false);
    // vanity, basin and mirror
    roomBox(2.4,.85,.75,mats.walnut,2.5,.55,-4.9,"Bathroom Vanity",true);
    roomBox(2.15,.18,.7,mats.marble,2.5,1.02,-4.85,"Vanity Counter",false);
    roomBox(1.45,1.6,.08,mats.glass,2.5,2.45,-5.82,"Bathroom Mirror",false);
    const basin=new THREE.Mesh(new THREE.SphereGeometry(.48,24,12),new THREE.MeshStandardMaterial({color:0xf8f8f4,roughness:.18}));
    basin.scale.set(1,.35,.72);basin.position.set(2.5,1.13,-4.83);basin.castShadow=true;scene.add(basin);roomParts.push(basin);
    roomBox(1.2,1.5,.12,mats.white,5.6,2.0,-5.78,"Frosted Bathroom Window",false);
    roomBox(1.08,1.35,.06,mats.glass,5.6,2.0,-5.69,"Bathroom Window Glass",false);
    // toilet: cistern and rounded bowl
    roomBox(.85,.9,.35,mats.white,4.8,.55,-2.7,"Toilet Cistern",true);
    const toilet=new THREE.Mesh(new THREE.SphereGeometry(.58,24,16),new THREE.MeshStandardMaterial({color:0xf7f7f3,roughness:.25}));
    toilet.scale.set(.78,.58,1.0);toilet.position.set(4.8,.48,-1.95);toilet.castShadow=true;scene.add(toilet);roomParts.push(toilet);
    roomBox(2.2,.08,.08,mats.metal,2.5,2.0,-5.55,"Towel Rail",false);
  } else {
    // window and curtains in non-bathroom rooms
    const frameMat=new THREE.MeshStandardMaterial({color:0x343a40,metalness:.45,roughness:.35});
    roomBox(roomType==="Study"?3.5:4.5,roomType==="Study"?2.4:3,.15,frameMat,0,3.4,-5.87,"WindowFrame",false);
    roomBox(roomType==="Study"?3.2:4.1,roomType==="Study"?2.1:2.6,.08,mats.glass,0,3.4,-5.95,"Glass Window",false);
    if(roomType!=="Kitchen"){
      const curtainMat=new THREE.MeshStandardMaterial({color:roomType==="Bedroom"?0x9ba7b2:0xb8aaa0,roughness:.95});
      roomBox(.7,3.5,.25,curtainMat,-2.55,3.35,-5.72,"Curtain L",true);
      roomBox(.7,3.5,.25,curtainMat,2.55,3.35,-5.72,"Curtain R",true);
    }
    roomBox(1.5,3.8,.15,mats.walnut,5.8,1.9,-5.8,"Door",false);
  }

  if(roomType==="Kitchen"){
    const cabinet=new THREE.MeshStandardMaterial({color:0xe6dfd1,roughness:.58});
    const counter=new THREE.MeshStandardMaterial({color:0x343a3c,roughness:.25,metalness:.08});
    // L-shaped kitchen run, upper cupboards and backsplash
    roomBox(6.3,.95,.85,cabinet,-2.9,.52,-4.85,"Kitchen Base Cabinets",true);
    roomBox(6.45,.16,.95,counter,-2.9,1.08,-4.78,"Kitchen Countertop",false);
    roomBox(6.1,1.15,.12,tileColor(0xe7e1d5),-2.9,1.75,-5.72,"Kitchen Backsplash",false);
    roomBox(6.1,1.15,.55,cabinet,-2.9,2.95,-5.35,"Upper Kitchen Cabinets",true);
    // cupboard door seams and handles
    for(let x of [-5.3,-4.1,-2.9,-1.7,-.5]){
      roomBox(.025,.78,.015,new THREE.MeshStandardMaterial({color:0xb8ad9b}),x,.52,-4.405,"Cabinet Seam",false);
      roomBox(.06,.18,.045,mats.metal,x+.28,.55,-4.36,"Cabinet Handle",false);
      roomBox(.025,.92,.015,new THREE.MeshStandardMaterial({color:0xb8ad9b}),x,2.95,-5.065,"Upper Cabinet Seam",false);
    }
    // sink and faucet
    roomBox(1.35,.08,.58,mats.metal,-4.0,1.18,-4.75,"Kitchen Sink",false);
    roomBox(.08,.5,.08,mats.metal,-4.0,1.42,-5.05,"Kitchen Faucet",false);
    // cooktop and four burners
    roomBox(1.4,.06,.75,mats.dark,-1.3,1.2,-4.75,"Cooktop",false);
    for(let x of [-1.7,-.9])for(let z of [-4.95,-4.55]){
      const burner=new THREE.Mesh(new THREE.CylinderGeometry(.16,.16,.035,24),mats.metal);burner.position.set(x,1.25,z);scene.add(burner);roomParts.push(burner);
    }
    // refrigerator with separate door and handle
    roomBox(1.45,3.6,1.25,new THREE.MeshStandardMaterial({color:0xcbd0d2,metalness:.35,roughness:.28}),5.25,1.8,-4.9,"Refrigerator",true);
    roomBox(1.35,1.15,.035,new THREE.MeshStandardMaterial({color:0xdfe3e4,metalness:.3,roughness:.25}),5.25,2.95,-4.245,"Fridge Freezer Door",false);
    roomBox(.055,1.0,.06,mats.metal,5.75,2.25,-4.20,"Fridge Handle",false);
    // island / breakfast bar
    roomBox(3.2,.95,1.4,cabinet,1.0,.5,-1.9,"Kitchen Island",true);
    roomBox(3.35,.14,1.52,mats.marble,1.0,1.03,-1.9,"Kitchen Island Top",false);
  }
}
function tileColor(hex){return new THREE.MeshStandardMaterial({color:hex,roughness:.55});}
makeRoom("Living Room");

function addSofa(pos=[0,1,0]){
  const g=group("Sofa"); g.position.set(...pos); g.userData.type="sofa"; g.userData.category="Furniture";
  boxPart(g,3.4,.55,1.0,mats.fabric,0,.65,0);
  boxPart(g,3.4,1.2,.35,mats.fabric,0,1.25,-.32);
  boxPart(g,.45,.65,1.05,mats.fabric,-1.48,.72,0); boxPart(g,.45,.65,1.05,mats.fabric,1.48,.72,0);
  for(let x of [-1.05,1.05]) boxPart(g,.9,.18,.75,mats.velvet,x,1.18,.05);
  return g;
}
function boxPart(g,w,h,d,m,x,y,z){const q=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);q.position.set(x,y,z);q.castShadow=q.receiveShadow=true;g.add(q)}
function addTable(pos=[0,.45,0]){
  const g=group("Coffee Table");g.position.set(...pos);g.userData.type="table";
  boxPart(g,2.4,.18,1.3,mats.marble,0,1.05,0);
  for(const x of [-.9,.9]) for(const z of [-.45,.45]) boxPart(g,.14,1,.14,mats.gold,x,.5,z);
  return g;
}
function addBed(pos=[0,.7,0]){
  const g=group("Bed");g.position.set(...pos);g.userData.type="bed";
  boxPart(g,4,.35,6,mats.walnut,0,.35,0); boxPart(g,3.8,.65,5.8,mats.fabric,0,.8,0);
  boxPart(g,3.9,2.0,.3,mats.walnut,0,1.5,-2.8);
  boxPart(g,1.4,.28,1.0,mats.white,-1.0,1.3,-1.8);boxPart(g,1.4,.28,1.0,mats.white,1.0,1.3,-1.8);
  return g;
}
function addChair(pos=[0,.5,0]){
  const g=group("Chair");g.position.set(...pos);g.userData.type="chair";
  boxPart(g,1.3,.18,1.3,mats.leather,0,1,0);boxPart(g,1.3,1.8,.18,mats.leather,0,1.9,-.55);
  for(const x of [-.5,.5])for(const z of [-.5,.5])boxPart(g,.12,1,.12,mats.metal,x,.5,z);
  return g;
}
function addDesk(pos=[0,.6,0]){
  const g=group("Study Desk");g.position.set(...pos);g.userData.type="desk";
  boxPart(g,3,.22,1.4,mats.oak,0,1.2,0);for(const x of [-1.2,1.2])boxPart(g,.16,1.2,.16,mats.metal,x,.6,0);
  return g;
}
function addBookshelf(pos=[0,1,0]){
  const g=group("Bookshelf");g.position.set(...pos);g.userData.type="bookshelf";
  boxPart(g,2.6,4,.45,mats.walnut,0,2,0);for(let y of [1,2,3])boxPart(g,2.2,.12,.65,mats.oak,0,y,0.28);
  return g;
}
function addPlant(pos=[0,.2,0]){
  const g=group("Plant");g.position.set(...pos);g.userData.type="plant";
  const pot=new THREE.Mesh(new THREE.CylinderGeometry(.45,.55,.7,20),mats.marble);pot.position.y=.35;pot.castShadow=true;g.add(pot);
  for(let i=0;i<7;i++){const leaf=new THREE.Mesh(new THREE.SphereGeometry(.38,16,10),mats.green);leaf.scale.set(.7,.5,1.2);leaf.position.set(Math.sin(i)*.5,1.0+Math.cos(i)*.18,Math.cos(i)*.5);leaf.castShadow=true;g.add(leaf)}
  return g;
}
function addLamp(pos=[0,.2,0]){
  const g=group("Lamp");g.position.set(...pos);g.userData.type="lamp";
  cyl(.1,1.5,mats.gold,0,.8,0,"stem");const shade=cyl(.48,.65,mats.white,0,1.65,0,"shade");return g;
}
function addRug(pos=[0,.01,0]){
  const g=group("Rug");g.position.set(...pos);g.userData.type="rug";
  boxPart(g,4,.035,3,mats.velvet,0,0,0);return g;
}
function addSmall(type,pos=[0,1,0]){
  const g=group(type[0].toUpperCase()+type.slice(1));g.position.set(...pos);g.userData.type=type;
  if(type==="books"){for(let i=0;i<5;i++)boxPart(g,.35,.8,.6,new THREE.MeshStandardMaterial({color:[0x8d5a4a,0x42616b,0x7c6c49,0x5d4b6e,0x527054][i]}),i*.4-.8,.4,0)}
  if(type==="vase"){cyl(.35,.8,mats.glass,0,.4,0,"vase");}
  if(type==="painting"){boxPart(g,1.5,1,.08,mats.gold,0,.5,0)}
  if(type==="candle"){cyl(.12,.45,mats.white,0,.22,0,"candle");cyl(.16,.05,mats.gold,0,.47,0,"flame")}
  if(type==="clock"){cyl(.45,.12,mats.white,0,.45,0,"clock");}
  if(type==="towel"){boxPart(g,.75,.16,.12,new THREE.MeshStandardMaterial({color:0xe8f0ed,roughness:.95}),0,.08,0)}
  if(type==="cushion"){const q=new THREE.Mesh(new THREE.BoxGeometry(.7,.25,.7),mats.velvet);q.position.y=.15;q.rotation.z=.12;q.castShadow=true;g.add(q)}
  return g;
}

function addFurniture(type){
  let g;
  const p=[0,0,0];
  if(type==="sofa")g=addSofa([0,0,1.8]);
  else if(type==="table")g=addTable([0,0,0]);
  else if(type==="bed")g=addBed([0,0,0]);
  else if(type==="chair")g=addChair([0,0,0]);
  else if(type==="desk")g=addDesk([0,0,0]);
  else if(type==="bookshelf")g=addBookshelf([0,0,-4.9]);
  else if(type==="plant")g=addPlant([3,.0,2]);
  else if(type==="lamp")g=addLamp([-3,0,1]);
  else if(type==="rug")g=addRug([0,.0,0]);
  else if(type==="armchair"){g=addChair([-2,0,1]);g.name="Armchair";g.userData.type="armchair"}
  else if(type==="bedside")g=addTable([-2.8,0,-2]); 
  else if(type==="wardrobe")g=boxFurniture("Wardrobe",2.2,4,.7,mats.walnut,[4.9,0,-4.9],"wardrobe");
  else if(type==="mirror")g=boxFurniture("Mirror",1.4,2.3,.08,mats.glass,[-4.8,0,-5.7],"mirror");
  else if(type==="tv")g=boxFurniture("TV",2.5,1.5,.12,mats.dark,[0,1.5,-5.3],"tv");
  else if(type==="laptop")g=boxFurniture("Laptop",1.1,.08,.75,mats.metal,[0,1.35,0],"laptop");
  else g=addSmall(type,[0,1,0]);
  if(g && !objects.includes(g))objects.push(g);
  select(g);
  snapshot();
  toast(`${g.name} added`);
  return g;
}
function boxFurniture(name,w,h,d,mat,pos,type){
  const g=group(name);g.position.set(...pos);g.userData.type=type;boxPart(g,w,h,d,mat,0,h/2,0);return g;
}

function clearFurniture(){
  [...objects].forEach(o=>{if(o.parent===scene){scene.remove(o);}});
  objects.length=0;selected=null;updateObjectTools();
}
function starterRoom(){
  clearFurniture();
  addRug([0,0,0]);addSofa([0,0,1.7]);addTable([0,0,0]);addPlant([4,0,2]);addBookshelf([4.7,0,-4.8]);
  toast("Room ready — start decorating!");
}
starterRoom();

function select(obj){
  if(selected && selected.userData.outline) selected.userData.outline.visible=false;
  selected=obj;
  if(obj){
    if(!obj.userData.outline){
      const box3=new THREE.Box3().setFromObject(obj);const size=box3.getSize(new THREE.Vector3());const center=box3.getCenter(new THREE.Vector3());
      const geo=new THREE.BoxGeometry(Math.max(size.x,.3)*1.05,Math.max(size.y,.3)*1.05,Math.max(size.z,.3)*1.05);
      const edges=new THREE.EdgesGeometry(geo);const line=new THREE.LineSegments(edges,new THREE.LineBasicMaterial({color:0xe0b27a}));
      line.position.copy(center).sub(obj.position);line.visible=false;obj.add(line);obj.userData.outline=line;
    }
    obj.userData.outline.visible=true;
  }
  updateObjectTools();
}
function updateObjectTools(){
  const el=document.getElementById("objectTools");
  if(!selected){el.innerHTML='<div class="muted">Select an object to edit it.</div>';document.getElementById("selectedInfo").classList.add("hidden");return}
  el.innerHTML=`<div class="object-card"><b>${selected.name}</b><br><span class="muted">Type: ${selected.userData.type||"object"}</span><br>
  <button id="objRot">↻ Rotate</button><button id="objDup">⧉ Duplicate</button><button id="objDel">🗑 Delete</button>
  <button id="matOak">Oak</button><button id="matMarble">Marble</button><button id="matVelvet">Velvet</button></div>`;
  document.getElementById("objRot").onclick=()=>rotateSelected();
  document.getElementById("objDup").onclick=()=>duplicateSelected();
  document.getElementById("objDel").onclick=()=>deleteSelected();
  document.getElementById("matOak").onclick=()=>applyMaterial(mats.oak);
  document.getElementById("matMarble").onclick=()=>applyMaterial(mats.marble);
  document.getElementById("matVelvet").onclick=()=>applyMaterial(mats.velvet);
  const si=document.getElementById("selectedInfo");si.textContent=`Selected: ${selected.name}`;si.classList.remove("hidden");
}
function hexToInt(hex){
  return parseInt(String(hex).replace("#",""),16);
}

function makeProceduralTexture(type, baseColor="#9a633b"){
  if(type==="plain") return null;

  const canvas=document.createElement("canvas");
  canvas.width=512; canvas.height=512;
  const ctx=canvas.getContext("2d");
  const base=baseColor;

  ctx.fillStyle=base;
  ctx.fillRect(0,0,512,512);

  if(type==="wood"){
    ctx.globalAlpha=.28;
    for(let i=0;i<90;i++){
      ctx.strokeStyle=i%3===0?"#2f1b10":"#d7a36a";
      ctx.lineWidth=1+Math.random()*4;
      ctx.beginPath();
      const y=i*6+Math.random()*8;
      ctx.moveTo(0,y);
      ctx.bezierCurveTo(130,y-12,260,y+16,512,y-4);
      ctx.stroke();
    }
  }else if(type==="marble"){
    ctx.globalAlpha=.35;
    for(let i=0;i<22;i++){
      ctx.strokeStyle=i%2?"#ffffff":"#777777";
      ctx.lineWidth=1+Math.random()*2;
      ctx.beginPath();
      ctx.moveTo(Math.random()*512,0);
      ctx.bezierCurveTo(Math.random()*512,160,Math.random()*512,350,Math.random()*512,512);
      ctx.stroke();
    }
  }else if(type==="stone"){
    ctx.globalAlpha=.2;
    for(let i=0;i<900;i++){
      ctx.fillStyle=i%2?"#ffffff":"#222222";
      const x=Math.random()*512,y=Math.random()*512,r=Math.random()*3;
      ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
    }
  }else if(type==="fabric"){
    ctx.globalAlpha=.2;
    ctx.strokeStyle="#ffffff";ctx.lineWidth=1;
    for(let i=0;i<512;i+=6){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,512);ctx.stroke();ctx.beginPath();ctx.moveTo(0,i);ctx.lineTo(512,i);ctx.stroke();}
  }else if(type==="leather"){
    ctx.globalAlpha=.16;
    for(let i=0;i<700;i++){
      ctx.fillStyle=i%2?"#000":"#fff";
      const x=Math.random()*512,y=Math.random()*512,r=.5+Math.random()*2;
      ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
    }
  }else if(type==="metal"){
    const g=ctx.createLinearGradient(0,0,512,0);
    g.addColorStop(0,"rgba(255,255,255,.05)");
    g.addColorStop(.45,"rgba(255,255,255,.35)");
    g.addColorStop(.5,"rgba(0,0,0,.15)");
    g.addColorStop(1,"rgba(255,255,255,.05)");
    ctx.fillStyle=g;ctx.fillRect(0,0,512,512);
  }else if(type==="tile"){
    ctx.globalAlpha=.32;
    ctx.strokeStyle="#ffffff";ctx.lineWidth=4;
    for(let x=0;x<=512;x+=64){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,512);ctx.stroke();}
    for(let y=0;y<=512;y+=64){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(512,y);ctx.stroke();}
  }else if(type==="glass"){
    const g=ctx.createLinearGradient(0,0,512,512);
    g.addColorStop(0,"rgba(255,255,255,.35)");
    g.addColorStop(.45,"rgba(150,210,240,.08)");
    g.addColorStop(1,"rgba(255,255,255,.25)");
    ctx.fillStyle=g;ctx.fillRect(0,0,512,512);
  }

  const tex=new THREE.CanvasTexture(canvas);
  tex.wrapS=THREE.RepeatWrapping;
  tex.wrapT=THREE.RepeatWrapping;
  tex.repeat.set(type==="tile"?4:2,type==="tile"?4:2);
  tex.colorSpace=THREE.SRGBColorSpace;
  return tex;
}

function buildCustomMaterial(color, textureType, roughness){
  const texture=makeProceduralTexture(textureType,color);
  const material = textureType==="glass"
    ? new THREE.MeshPhysicalMaterial({
        color:hexToInt(color), map:texture, transparent:true, opacity:.42,
        roughness:.08, metalness:.05, transmission:.4
      })
    : new THREE.MeshStandardMaterial({
        color:hexToInt(color), map:texture, roughness,
        metalness:textureType==="metal" ? .82 : 0
      });
  material.userData={customColor:color,customTexture:textureType,customRoughness:roughness};
  return material;
}

function getTargetMeshes(target){
  const names={
    floor:["Wooden Floor","Bathroom Tile Floor"],
    backWall:["Back Wall"],
    leftWall:["Left Wall"],
    rightWall:["Right Wall"],
    ceiling:["Ceiling"],
    door:["Door"],
    window:["Glass Window"],
    curtains:["Curtain L","Curtain R"]
  };
  if(target==="selected"){
    if(!selected){toast("Select a furniture item first");return []}
    const result=[];
    selected.traverse(o=>{if(o.isMesh)result.push(o)});
    return result;
  }
  const result=[];
  (names[target]||[]).forEach(name=>{
    const o=scene.getObjectByName(name);
    if(o && o.isMesh) result.push(o);
  });
  return result;
}

function applySurfaceCustomization(target,color,textureType,roughness){
  const meshes=getTargetMeshes(target);
  if(!meshes.length)return;
  const mat=buildCustomMaterial(color,textureType,roughness);
  meshes.forEach(mesh=>{
    mesh.material=mat.clone();
    mesh.material.userData={...mat.userData};
    mesh.material.needsUpdate=true;
  });
  snapshot();
  toast(`${target==="selected"?"Object":target} updated: ${textureType} + ${color}`);
}

function applyMaterialToTarget(target,mat){
  const meshes=getTargetMeshes(target);
  if(!meshes.length)return;
  meshes.forEach(mesh=>{
    mesh.material=mat.clone();
    mesh.material.needsUpdate=true;
  });
  snapshot();
  toast(`${target==="selected"?"Object":target} material updated`);
}

function applyMaterial(mat){if(!selected){toast("Select an object first");return}applyMaterialToTarget("selected",mat);}
function rotateSelected(){if(!selected)return;gsap.to(selected.rotation,{y:selected.rotation.y+Math.PI/2,duration:.3});snapshot()}
function duplicateSelected(){if(!selected)return;const c=selected.clone(true);c.position.x+=1;c.name=selected.name+" Copy";c.userData={...selected.userData};scene.add(c);objects.push(c);select(c);snapshot()}
function deleteSelected(){if(!selected)return;scene.remove(selected);objects.splice(objects.indexOf(selected),1);selected=null;updateObjectTools();snapshot();toast("Object removed")}
function moveSelected(dx,dz){if(!selected)return;selected.position.x+=dx;selected.position.z+=dz;if(snapEnabled)applySnap(selected);snapshot()}
function applySnap(o){
  if(Math.abs(o.position.x-6.4)<.45){o.position.x=6.35;o.rotation.y=Math.PI/2}
  if(Math.abs(o.position.x+6.4)<.45){o.position.x=-6.35;o.rotation.y=-Math.PI/2}
  if(Math.abs(o.position.z+5.4)<.45){o.position.z=-5.35;o.rotation.y=0}
  o.position.y=Math.max(0,o.position.y);
}

function pointer(e){
  const r=renderer.domElement.getBoundingClientRect();
  mouse.x=((e.clientX-r.left)/r.width)*2-1;mouse.y=-((e.clientY-r.top)/r.height)*2+1;
}
renderer.domElement.addEventListener("pointerdown",e=>{
  pointer(e);raycaster.setFromCamera(mouse,camera);
  const hits=raycaster.intersectObjects(objects,true);
  if(hits.length){
    let o=hits[0].object;while(o.parent && !objects.includes(o))o=o.parent;
    select(o);dragging=true;
    const plane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
    const p=new THREE.Vector3();raycaster.ray.intersectPlane(plane,p);dragOffset.copy(o.position).sub(p);
    controls.enabled=false;
  } else select(null);
});
renderer.domElement.addEventListener("pointermove",e=>{
  if(!dragging||!selected)return;
  pointer(e);raycaster.setFromCamera(mouse,camera);
  const plane=new THREE.Plane(new THREE.Vector3(0,1,0),0);const p=new THREE.Vector3();
  if(raycaster.ray.intersectPlane(plane,p)){selected.position.x=p.x+dragOffset.x;selected.position.z=p.z+dragOffset.z;selected.position.y=Math.max(0,selected.position.y);if(snapEnabled)applySnap(selected)}
});
window.addEventListener("pointerup",()=>{if(dragging){dragging=false;controls.enabled=true;snapshot();toast("Placed")}});

window.addEventListener("keydown",e=>{
  if(e.key.toLowerCase()==="r")rotateSelected();
  if(e.key==="Delete")deleteSelected();
  if(e.key.toLowerCase()==="p")togglePhoto();
  if(e.ctrlKey&&e.key.toLowerCase()==="z")undo();
  if(e.ctrlKey&&e.key.toLowerCase()==="y")redo();
});

function snapshot(){
  if(!objects.length)return;
  history.push(objects.map(o=>({name:o.name,type:o.userData.type,pos:o.position.toArray(),rot:o.rotation.toArray(),scale:o.scale.toArray()})));
  if(history.length>30)history.shift();future=[];
}
function restore(data){
  objects.slice().forEach(o=>scene.remove(o));objects.length=0;
  data.forEach(d=>{const g=addFurniture(d.type||"plant");g.name=d.name;g.position.fromArray(d.pos);g.rotation.fromArray(d.rot);g.scale.fromArray(d.scale)});
}
function undo(){if(history.length<2)return;const current=history.pop();future.push(current);restore(history[history.length-1]);toast("Undo")}
function redo(){if(!future.length)return;const d=future.pop();history.push(d);restore(d);toast("Redo")}

function renderCatalog(panel="furniture"){
  const c=document.getElementById("catalog");
  if(panel==="furniture"){
    c.innerHTML="";
    for(const [cat,items] of Object.entries(catalog)){const t=document.createElement("div");t.className="category-title";t.textContent=cat;c.appendChild(t);for(const [type,icon,name] of items){const b=document.createElement("button");b.className="item";b.innerHTML=`<span class="icon">${icon}</span><span>${name}<small>Click to add</small></span>`;b.onclick=()=>addFurniture(type);c.appendChild(b)}}
  }else if(panel==="materials"){
    c.innerHTML = `
      <div class="category-title">SURFACE CUSTOMIZER</div>
      <div class="material-editor">
        <label>Apply To
          <select id="surfaceTarget">
            <option value="selected">Selected Furniture / Object</option>
            <option value="floor">Floor</option>
            <option value="backWall">Back Wall</option>
            <option value="leftWall">Left Wall</option>
            <option value="rightWall">Right Wall</option>
            <option value="ceiling">Ceiling</option>
            <option value="door">Door</option>
            <option value="window">Window Glass</option>
            <option value="curtains">Curtains</option>
          </select>
        </label>
        <label>Base Colour
          <input id="surfaceColor" type="color" value="#9a633b">
        </label>
        <label>Texture
          <select id="surfaceTexture">
            <option value="plain">Plain</option>
            <option value="wood">Wood Grain</option>
            <option value="marble">Marble</option>
            <option value="stone">Stone</option>
            <option value="fabric">Fabric</option>
            <option value="leather">Leather</option>
            <option value="metal">Metal</option>
            <option value="tile">Tiles</option>
            <option value="glass">Glass</option>
          </select>
        </label>
        <label>Roughness
          <input id="surfaceRoughness" type="range" min="0.05" max="1" step="0.05" value="0.6">
        </label>
        <button id="applySurface" class="apply-surface">✓ Apply Material</button>
      </div>

      <div class="category-title">QUICK MATERIALS</div>
      <div class="material-grid">
        ${Object.entries(mats).map(([k])=>`<button data-mat="${k}">${k.replace(/([A-Z])/g," $1")}</button>`).join("")}
      </div>
      <div class="material-help">Choose a surface, colour and texture, then click Apply Material. Furniture can be selected directly in the room.</div>
    `;

    const apply = () => {
      const target = document.getElementById("surfaceTarget").value;
      const color = document.getElementById("surfaceColor").value;
      const texture = document.getElementById("surfaceTexture").value;
      const roughness = Number(document.getElementById("surfaceRoughness").value);
      applySurfaceCustomization(target, color, texture, roughness);
    };
    document.getElementById("applySurface").onclick = apply;
    c.querySelectorAll("[data-mat]").forEach(b=>b.onclick=()=>{
      const target=document.getElementById("surfaceTarget").value;
      applyMaterialToTarget(target, mats[b.dataset.mat]);
    });
  }else if(panel==="style"){
    const styles=["Modern","Scandinavian","Rustic","Luxury","Boho","Classic","Gaming","Japandi","Industrial","Coastal"];
    c.innerHTML='<div class="category-title">DESIGN STYLES</div><div class="style-grid">'+styles.map(s=>`<button>${s}</button>`).join("")+'</div>';
    c.querySelectorAll("button").forEach(b=>b.onclick=()=>applyStyle(b.textContent));
  }else if(panel==="lighting"){
    c.innerHTML='<div class="category-title">TIME OF DAY</div><div class="style-grid"><button>☀ Morning</button><button>🌤 Afternoon</button><button>🌅 Sunset</button><button>🌙 Night</button></div>';
    c.querySelectorAll("button").forEach(b=>b.onclick=()=>setLighting(b.textContent));
  }else if(panel==="challenge"){
    c.innerHTML=`<div class="category-title">TODAY'S CHALLENGE</div><div class="object-card"><h3>Cozy Scandinavian Room</h3><p>Use wooden flooring, a sofa or bed, two lamps and a plant. Use a neutral material palette.</p><button id="startChallenge">START / CHECK</button></div><div class="category-title">OTHER CHALLENGES</div><div class="object-card">Luxury Living Room<br><br>Modern Study<br><br>Boho Bedroom<br><br>Gaming Room</div>`;
    document.getElementById("startChallenge").onclick=scoreDesign;
  }else if(panel==="room"){
    c.innerHTML='<div class="category-title">ROOM TEMPLATES · UNIQUE LAYOUTS</div><div class="style-grid"><button>Living Room</button><button>Bedroom</button><button>Kitchen</button><button>Bathroom</button><button>Study</button></div>';
    c.querySelectorAll("button").forEach(b=>b.onclick=()=>changeRoom(b.textContent));
  }
}
renderCatalog();

document.querySelectorAll(".tab").forEach(t=>t.onclick=()=>{document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));t.classList.add("active");renderCatalog(t.dataset.panel)});

function applyStyle(style){
  const colors={Modern:0xeeeae0,Scandinavian:0xd8d2c6,Rustic:0x9d7758,Luxury:0x24252a,Boho:0xc38e62,Classic:0xe9dfcc,Gaming:0x293248,Japandi:0xd0c4ae,Industrial:0x77716b,Coastal:0xd9eee9};
  const wall=scene.getObjectByName("Back Wall");if(wall)wall.material=new THREE.MeshStandardMaterial({color:colors[style]||0xffffff,roughness:.8});
  toast(`${style} style applied`);
}
function setLighting(label){
  const sun=scene.getObjectByName("sun"), room=scene.getObjectByName("roomLight");
  const map={
    "☀ Morning":[0xfff3d5,3.5,0xffc88f,1.0,[2,8,3]],
    "🌤 Afternoon":[0xffffff,3.2,0xffd8b0,1.0,[6,9,1]],
    "🌅 Sunset":[0xff9b55,2.3,0xff8b48,2.2,[-5,5,3]],
    "🌙 Night":[0x62769a,.45,0xffb070,2.8,[-2,6,2]]
  };
  const [c,i,rc,ri,pos]=map[label]||map["🌤 Afternoon"];
  sun.color.setHex(c);sun.intensity=i;sun.position.set(...pos);room.color.setHex(rc);room.intensity=ri;sunTime=label;toast(`${label} lighting`);
}
function cleanRoom(){if(cleaned){toast("Room already cleaned");return}cleaned=true;toast("Cleaning room…");gsap.to(camera.position,{y:5.2,duration:.6});addXP(30)}
function changeRoom(name){
  clearFurniture();
  makeRoom(name);
  if(name==="Bedroom"){
    addBed([-1.1,0,0]);
    addTable([2.2,0,-2.6]);
    addFurniture("wardrobe");
    addPlant([4.7,0,2.6]);
    // bedside rug and bedroom dressing details
    const rug=addRug([-1.0,0,1.2]);rug.name="Bedroom Rug";
  } else if(name==="Study"){
    addDesk([0,0,-1.4]);
    addChair([0,0,.1]);
    addBookshelf([4.6,0,-4.75]);
    addFurniture("laptop");
    addPlant([4.8,0,2.5]);
    addRug([0,0,1.3]);
  } else if(name==="Kitchen"){
    // The fixed kitchen cabinetry, sink, stove, fridge and island are part of the room shell.
    addTable([1.0,0,1.5]);
    addChair([-1.0,0,1.6]);
    addChair([3.0,0,1.6]);
    addPlant([5.0,0,2.4]);
    addSmall("vase",[1.0,1.2,1.5]);
  } else if(name==="Bathroom"){
    // Bathroom fixtures (shower, vanity, basin, toilet and towel rail) are built into the room.
    addPlant([0.1,0,2.8]);
    addSmall("candle",[2.5,1.2,-4.8]);
    addSmall("towel",[2.5,1.8,-5.4]);
  } else {
    starterRoom();
  }
  controls.target.set(0,2,0);
  gsap.to(camera.position,{x:name==="Bathroom"?8:7.5,y:name==="Kitchen"?6.2:5.8,z:name==="Bedroom"?9.5:8.5,duration:.55});
  toast(`${name} loaded — room-specific layout ready`);
}

function unbox(){const types=["sofa","bed","lamp","plant","books","vase","cushion"];const type=types[Math.floor(Math.random()*types.length)];const g=addFurniture(type);g.scale.setScalar(.1);gsap.to(g.scale,{x:1,y:1,z:1,duration:.7,ease:"back.out(1.7)"});toast("📦 Box opened!");addXP(20)}
function scoreDesign(){
  const types=objects.map(o=>o.userData.type);
  let score=40;
  if(types.includes("sofa")||types.includes("bed"))score+=15;
  if(types.includes("lamp"))score+=10;
  if(types.includes("plant"))score+=10;
  if(types.includes("rug"))score+=8;
  if(types.length>=6)score+=10;
  if(sunTime.includes("Sunset")||sunTime.includes("Night"))score+=4;
  score=Math.min(100,score);
  const overlay=document.getElementById("scoreOverlay");overlay.innerHTML=`<div class="score-card"><h1>✨ DESIGN COMPLETE</h1><div class="muted">RoomCraft Design Evaluation</div><div class="score-big">${score}<small>/100</small></div><div class="score-row"><span>Aesthetic</span><span>${"★".repeat(Math.ceil(score/20))}</span></div><div class="score-row"><span>Furniture</span><span>★★★★☆</span></div><div class="score-row"><span>Lighting</span><span>★★★★☆</span></div><div class="score-row"><span>Layout</span><span>★★★★★</span></div><br><button id="closeScore">Continue</button></div>`;overlay.classList.remove("hidden");document.getElementById("closeScore").onclick=()=>overlay.classList.add("hidden");addXP(score)}
function addXP(n){xp+=n;while(xp>=1000){xp-=1000;level++}localStorage.setItem("rc_xp",xp);localStorage.setItem("rc_level",level);updateXP()}
function updateXP(){document.getElementById("xp").textContent=`XP ${xp}/1000`;document.getElementById("level").textContent=`LEVEL ${level}`}
function toast(msg){const t=document.getElementById("toast");t.textContent=msg;t.style.opacity=1;clearTimeout(window.__toast);window.__toast=setTimeout(()=>t.style.opacity=0,1600)}
function saveGame(){
  const data={version:1,xp,level,sunTime,objects:objects.map(o=>({name:o.name,type:o.userData.type,pos:o.position.toArray(),rot:o.rotation.toArray(),scale:o.scale.toArray()}))};
  localStorage.setItem("roomcraft_save",JSON.stringify(data));toast("Design saved ✓")
}
function loadGame(){
  const raw=localStorage.getItem("roomcraft_save");if(!raw){toast("No saved design");return}
  const d=JSON.parse(raw);xp=d.xp||0;level=d.level||1;clearFurniture();
  (d.objects||[]).forEach(x=>{const g=addFurniture(x.type||"plant");g.name=x.name;g.position.fromArray(x.pos);g.rotation.fromArray(x.rot);g.scale.fromArray(x.scale)});
  setLighting(d.sunTime||"🌤 Afternoon");updateXP();toast("Design loaded ✓")
}
function togglePhoto(){document.body.classList.toggle("photo");const active=document.body.classList.contains("photo");toast(active?"Photo Mode":"Photo Mode off")}
function beforeAfter(){document.body.classList.toggle("before-after");toast(document.body.classList.contains("before-after")?"Before view":"After view")}
document.getElementById("saveBtn").onclick=saveGame;
document.getElementById("loadBtn").onclick=loadGame;
document.getElementById("undoBtn").onclick=undo;
document.getElementById("redoBtn").onclick=redo;
document.getElementById("cleanBtn").onclick=cleanRoom;
document.getElementById("unboxBtn").onclick=unbox;
document.getElementById("photoBtn").onclick=togglePhoto;
document.getElementById("beforeAfterBtn").onclick=beforeAfter;
document.getElementById("scoreBtn").onclick=scoreDesign;
document.getElementById("snapToggle").onchange=e=>snapEnabled=e.target.checked;
document.getElementById("shadowToggle").onchange=e=>renderer.shadowMap.enabled=e.target.checked;
document.getElementById("moveMode").onclick=()=>mode="move";
document.getElementById("rotateMode").onclick=rotateSelected;
document.getElementById("scaleMode").onclick=()=>{if(selected)gsap.to(selected.scale,{x:selected.scale.x*1.1,y:selected.scale.y*1.1,z:selected.scale.z*1.1,duration:.2})};
document.getElementById("deleteMode").onclick=deleteSelected;
document.getElementById("duplicateMode").onclick=duplicateSelected;
document.getElementById("resetBtn").onclick=()=>{if(confirm("Start a new design?")){changeRoom(currentRoom);}};
document.getElementById("quality").onchange=e=>{renderer.setPixelRatio(e.target.value==="High"?Math.min(devicePixelRatio,2):e.target.value==="Medium"?1.4:1);renderer.setSize(viewport.clientWidth,viewport.clientHeight);};

window.addEventListener("resize",()=>{camera.aspect=viewport.clientWidth/viewport.clientHeight;camera.updateProjectionMatrix();renderer.setSize(viewport.clientWidth,viewport.clientHeight)});
updateXP();
document.getElementById("loading").style.display="none";

function animate(){
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene,camera);
}
animate();
snapshot();
