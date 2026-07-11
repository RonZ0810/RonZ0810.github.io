(function(){
  "use strict";
  const C=(id,name,rarity,description,effect,max=99,type="passive",tags=[])=>({id,name,rarity,description,effect,max,type,tags});
  const L=(id,name,biome,difficulty,time,balls,enemies,bumpers,extra={})=>({id,name,biome,difficulty,time,balls,enemies,bumpers,chargeRate:4.2+id*.36,barrage:5.2+id*.34,...extra});
  window.FLIP_DATA={
    VERSION:2,
    WORLD:{width:540,height:960},
    rarities:{common:"#809da0",rare:"#58b9c4",superRare:"#d0915d",legendary:"#d66f68",ultra:"#ead7a2"},
    difficulty:{green:{name:"CALM",color:"#74b79a"},lime:{name:"EASY",color:"#a6bd78"},yellow:{name:"TESTED",color:"#d1ad68"},orange:{name:"HARD",color:"#cf855f"},red:{name:"SEVERE",color:"#c76863"},darkred:{name:"EXTREME",color:"#984d50"}},
    biomes:{
      calibration:{name:"CALIBRATION ARRAY",accent:"#62d4df",top:"#122b32",bottom:"#061116",grid:"rgba(98,212,223,.06)"},
      foundry:{name:"EMBER FOUNDRY",accent:"#d0915d",top:"#34251f",bottom:"#130d0c",grid:"rgba(208,145,93,.07)"}
    },
    cards:[
      C("reinforced","REINFORCED CORE","common","Ball damage increases by 20%.",{damage:.2},5,"passive",["impact"]),
      C("spring","SPRING TIPS","common","Flippers strike 14% harder.",{flipperPower:.14},4,"passive",["precision"]),
      C("wider","WIDER GUARD","common","Flippers grow 9% longer.",{flipperLength:.09},3,"passive",["machine"]),
      C("fuse","LONGER FUSE","common","Add 12 seconds to every level.",{time:12},4,"passive",["defense"]),
      C("resonator","XP RESONATOR","common","All XP gains increase by 18%.",{xp:.18},4,"passive",["combo"]),
      C("spare","SPARE BALL","common","Immediately gain one ball.",{balls:1},5,"passive",["defense"]),
      C("stabilizer","COMBO STABILIZER","common","Combo decay becomes 30% slower.",{comboHold:.3},3,"passive",["combo"]),
      C("dense","DENSE ALLOY","common","Ball gains 12% damage and weight.",{damage:.12,mass:.12},4,"passive",["impact"]),
      C("focus","SIGHTLINE","common","Excellent shots need slightly less speed.",{excellent:-2},3,"passive",["precision"]),
      C("bumper","BUMPER CREDIT","common","Bumper hits earn 5 extra XP.",{bumperXp:5},4,"passive",["ricochet"]),
      C("repair","FIELD REPAIR","common","Restore defense and add 8 seconds. One use.",{repair:1,time:8},5,"consumable",["defense"]),
      C("coolant","COOLANT CELL","common","Slow enemy charge by 10%.",{chargeSlow:.1},3,"passive",["defense"]),
      C("twin","TWIN LAUNCH","rare","Every new launch releases a second ball.",{multiball:1},1,"passive",["multiball"]),
      C("arc","ARC RELAY","rare","Hits chain 35% damage to a nearby enemy.",{chain:.35},3,"passive",["chain"]),
      C("magnet","MAGNETIC RETURN","rare","Once per ball, rescue it from the drain.",{rescue:1},1,"passive",["defense","magnet"]),
      C("nudge","NUDGE DRIVE","rare","Unlock Shift to nudge active balls upward.",{nudge:1},1,"passive",["machine"]),
      C("cannon","PLUNGER CANNON","rare","Freshly launched balls deal triple damage for 2 seconds.",{plunger:3},1,"passive",["precision","impact"]),
      C("bankshot","BANK SHOT","rare","Ricochet hits deal 45% more damage.",{ricochet:.45},3,"passive",["ricochet"]),
      C("echo","ECHO CHAMBER","rare","Every fifth hit repeats for half damage.",{echo:.5},2,"passive",["combo"]),
      C("velocity","VELOCITY LOOP","rare","Combo increases ball speed slightly.",{velocity:.03},3,"passive",["combo","impact"]),
      C("shieldpulse","SHIELD PULSE","rare","Clearing a barrage grants 6 seconds.",{clearTime:6},2,"passive",["defense"]),
      C("splitxp","SPLIT DIVIDEND","rare","Multiball hits grant 35% more XP.",{multiXp:.35},2,"passive",["multiball"]),
      C("critical","CRITICAL CORE","superRare","Hits have a 16% chance to deal double damage.",{crit:.16},3,"passive",["precision"]),
      C("third","TRI-FLIP ARRAY","superRare","Install a compact upper flipper.",{thirdFlipper:1},1,"passive",["machine"]),
      C("phase","PHASE SHIELD","superRare","Gain one defense point each barrage.",{shield:1},2,"passive",["defense"]),
      C("pierce","PHASE BALL","superRare","Ignore one layer of armor on every hit.",{pierce:1},1,"passive",["impact"]),
      C("nova","NOVA BUMPER","superRare","Every eighth bumper hit damages all enemies.",{nova:8},1,"passive",["ricochet","chain"]),
      C("recall","BALL RECALL","superRare","Every 12-hit combo restores one ball once per level.",{recall:12},1,"passive",["combo","defense"]),
      C("storm","STORM PAIR","superRare","Two active balls increase each other's damage by 30%.",{pairDamage:.3},2,"passive",["multiball"]),
      C("gravity","GRAVITY WELL","superRare","Nearby enemies gently pull the ball.",{homing:.5},1,"passive",["magnet"]),
      C("overdrive","OVERDRIVE","legendary","After an Excellent shot, damage doubles for 7 seconds.",{overdrive:7},1,"passive",["precision","combo"]),
      C("cascade","CASCADE ENGINE","legendary","Kills chain 25 damage across all remaining enemies.",{killChain:25},2,"passive",["chain"]),
      C("trinity","TRINITY PROTOCOL","legendary","Every fifth launch creates three balls.",{tripleEvery:5},1,"passive",["multiball"]),
      C("fortress","FORTRESS MODE","legendary","Defense cannot fall below one on the first barrage.",{fortress:1},1,"passive",["defense"]),
      C("deadeye","DEADEYE","legendary","Excellent shots deal another 90% damage.",{excellentDamage:.9},1,"passive",["precision"]),
      C("singularity","SINGULARITY BALL","ultra","Ball grows, gains 70% damage, and pulls toward enemies.",{damage:.7,size:1.3,homing:1},1,"passive",["magnet","impact"]),
      C("infinity","INFINITY CIRCUIT","ultra","Every 10th hit duplicates all active balls.",{duplicate:10},1,"passive",["multiball"]),
      C("perfect","PERFECT MACHINE","ultra","Excellent shots freeze charge and add 3 seconds.",{perfect:3},1,"passive",["precision","defense"]),
      C("sun","CAPTIVE SUN","ultra","Bumpers release a damaging pulse every fourth hit.",{nova:4},1,"passive",["ricochet","chain"]),
      C("immortal","LAST LIGHT","ultra","Prevent the first level failure and restore one ball.",{lastLight:1},1,"passive",["defense"])
    ],
    levels:[
      L(1,"FIRST CONTACT","calibration","green",72,4,[{type:"drone",x:178,y:300},{type:"drone",x:270,y:235},{type:"drone",x:362,y:300}],[[175,450,30],[365,450,30]],{layout:"orbit"}),
      L(2,"RICOCHET YARD","calibration","lime",76,4,[{type:"drone",x:155,y:300},{type:"swift",x:270,y:230},{type:"drone",x:385,y:300},{type:"swift",x:270,y:385}],[[145,430,28],[270,490,34],[395,430,28]],{layout:"crown"}),
      L(3,"SPLIT CURRENT","calibration","yellow",82,4,[{type:"shield",x:150,y:275},{type:"teleporter",x:270,y:205},{type:"shield",x:390,y:275},{type:"swift",x:270,y:390}],[[180,480,27],[360,480,27]],{gates:true,layout:"split"}),
      L(4,"RELAY BREACH","calibration","orange",90,5,[{type:"medic",x:270,y:210},{type:"drone",x:155,y:315},{type:"drone",x:385,y:315}],[[150,455,27],[390,455,27]],{waves:[[{type:"shield",x:190,y:260},{type:"swift",x:350,y:300}]],blockers:true}),
      L(5,"THE ARCHITECT","calibration","red",118,5,[{type:"architect",x:270,y:215}],[[170,455,29],[370,455,29]],{boss:true,blockers:true}),
      L(6,"EMBER GATE","foundry","yellow",92,5,[{type:"regenerator",x:165,y:270},{type:"charger",x:375,y:270},{type:"swift",x:270,y:385}],[[145,445,28],[270,500,31],[395,445,28]],{hazard:true}),
      L(7,"MOLTEN SWITCH","foundry","orange",98,5,[{type:"reflector",x:150,y:280},{type:"teleporter",x:270,y:205},{type:"reflector",x:390,y:280},{type:"medic",x:270,y:390}],[[175,475,26],[365,475,26]],{gates:true,hazard:true}),
      L(8,"ASSEMBLY LINE","foundry","red",106,6,[{type:"summoner",x:270,y:215},{type:"charger",x:155,y:315},{type:"charger",x:385,y:315}],[[135,455,26],[270,510,30],[405,455,26]],{waves:[[{type:"regenerator",x:180,y:275},{type:"reflector",x:360,y:275}],[{type:"elite",x:270,y:240}]],blockers:true,hazard:true}),
      L(9,"CRIMSON LOCK","foundry","darkred",116,6,[{type:"warden",x:270,y:220},{type:"medic",x:145,y:340},{type:"medic",x:395,y:340}],[[165,475,28],[375,475,28]],{elite:true,gates:true,blockers:true,hazard:true}),
      L(10,"THE FOUNDRY CORE","foundry","darkred",155,7,[{type:"core",x:270,y:205}],[[150,470,29],[390,470,29]],{boss:true,finalBoss:true,blockers:true,hazard:true})
    ],
    enemies:{
      drone:{name:"DRONE",hp:42,r:21,speed:32,color:"#62d4df",xp:22,pattern:"aim"},
      swift:{name:"SWIFT",hp:35,r:17,speed:68,color:"#8ab8bd",xp:25,pattern:"lane"},
      shield:{name:"AEGIS",hp:72,r:23,speed:28,color:"#d0915d",xp:38,armor:2,pattern:"spread"},
      teleporter:{name:"BLINK",hp:57,r:20,speed:42,color:"#8dc6cb",xp:36,teleport:true,pattern:"aim"},
      medic:{name:"MENDER",hp:64,r:21,speed:28,color:"#78b49a",xp:42,heal:true,pattern:"lane"},
      regenerator:{name:"CINDER",hp:82,r:23,speed:31,color:"#ce9367",xp:48,regen:2.2,pattern:"spread"},
      charger:{name:"RAMJET",hp:58,r:19,speed:76,color:"#d07762",xp:44,pattern:"lane"},
      reflector:{name:"MIRROR",hp:92,r:24,speed:25,color:"#ddb37b",xp:55,armor:1,pattern:"spread"},
      summoner:{name:"FORGEMIND",hp:130,r:29,speed:24,color:"#cb795f",xp:76,summon:true,pattern:"ring"},
      elite:{name:"EXECUTOR",hp:235,r:38,speed:42,color:"#d66f68",xp:125,elite:true,armor:2,pattern:"spread"},
      warden:{name:"THE WARDEN",hp:390,r:45,speed:38,color:"#d66f68",xp:155,elite:true,armor:3,pattern:"ring"},
      architect:{name:"THE ARCHITECT",hp:820,r:52,speed:34,color:"#ead7a2",xp:320,boss:true,phases:3,pattern:"spread"},
      core:{name:"FOUNDRY CORE",hp:1450,r:57,speed:38,color:"#e3a06e",xp:520,boss:true,phases:4,pattern:"ring"}
    }
  };
})();
