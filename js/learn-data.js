/* Hand-authored Learn curriculum (no templates). Every lesson has its own board, step sequence and goal.
   Rules cited from the Disney Lorcana Comprehensive Rules v2.3.0 (effective 2026-10-16),
   https://files.disneylorcana.com/CRUpdate_EN_Oct-2026.pdf  - see docs/learn-research.md.
   Cards: sets 9-13 only (set 14 has no card data in this app). Moves are replayed through
   LorcanaEngine (E.isLegal/E.act) by tools/validate-learn.js; puzzles are brute-forced there.
   Step kinds: demo (game makes the move), do (you make this exact move), goal (free play until goal),
   pick (choose an answer / cards), turn (end turn: rival passes, your ready + draw steps run). */
var LEARN_DATA=(function(){
const C={FILL:"Olaf - Friendly Snowman",
 MICKEY:"Mickey Mouse - True Friend",STEAM:"Mickey Mouse - Steamboat Pilot",AURORA:"Aurora - Regal Princess",STITCH:"Stitch - Alien Dancer",
 SIMBA:"Simba - Scrappy Cub",SEBA:"Sebastian - Loyal Crab",POOH:"Winnie the Pooh - Hunny Wizard",HIGGINS:"Higgins - Undercover Officer",
 KHAN:"Shere Khan - Keen-Eyed Hunter",BALOO:"Baloo - Laid-Back Bear",NAVEEN:"Prince Naveen - Penniless Royal",DAISY:"Daisy Duck - Isabel",
 CAULDRON:"Cauldron Born - Mindless Horde",BIGNOSE:"Big Nose - Lovesick Poet",MUSHU:"Mushu - Braggin' Dragon",KATRINA:"Katrina Van Tassel - Rosy-Cheeked Lass",
 TOD:"Tod - All Alone",CHIEN:"Chien-Po - Snow Warrior",COWS:"Space Cows - Unexpected Allies",TIBBS:"Sergeant Tibbs - Courageous Cat",
 FLOUNDER:"Flounder - Voice of Reason",PUA:"Pua - Disgruntled Pig",PIGLET:"Piglet - Entranced by Snow",MINNIE:"Minnie Mouse - Spinning Skater",
 NANI:"Nani - Protective Sister",HERC:"Hercules - True Hero",PEGASUS:"Pegasus - Gift for Hercules",VIOLET:"Violet Sabrewing - Senior Junior Woodchuck",
 CRIKEE:"Cri-Kee - Good Luck Charm",SYNDROME:"Syndrome - Evil Inventor",FROZONE:"Frozone - Super Slick",ALADDIN:"Aladdin - Prince Ali",KAA:"Kaa - Suspicious Serpent",
 EEYORE:"Eeyore - Overstuffed Donkey",HERMES:"Hermes - Harried Messenger",IAGO:"Iago - Stompin' Mad",GASTON:"Gaston - Arrogant Hunter",MULAN:"Mulan - Free Spirit",
 SHANG1:"Li Shang - Imperial Captain",SHANG2:"Li Shang - Valiant Leader",LILOST:"Lilo & Stitch - Fun-Loving Friends",URSULA:"Ursula - Vanessa",
 ARIEL:"Ariel - Singing Mermaid",POWERLINE:"Powerline - Taking the Stage",
 CANNONS:"Fire the Cannons!",SMASH:"Smash",WGCM:"World's Greatest Criminal Mind",HEAL:"Heal What Has Been Hurt",BEKING:"Be King Undisputed",
 PIRATE:"A Pirate's Life",SCOUT:"Scout Ahead",
 SOURCE:"Source of the Vine",LANTERN:"Lantern",MIRROR:"Magic Mirror",
 AGRABAH:"Agrabah - Marketplace",FATCAT:"Fat Cat's Club - Seedy Headquarters",COVE:"Hidden Cove - Tranquil Haven"};
const L=(id,title,concept,icon,setup,steps,o)=>Object.assign({id,title,concept,icon,setup,steps,xp:o&&o.test?20:10},o||{});
const q=(c)=>({t:"quest",c}), ink=(c)=>({t:"ink",c}), play=(c,x)=>Object.assign({t:"play",c},x||{}), chal=(c,target)=>({t:"challenge",c,target}),
 move=(c,loc)=>({t:"move",c,loc}), use=(c)=>({t:"act",c,i:0});
const chapters=[
{id:"ch1",title:"All the Basics",desc:"Everything you need to play, fast.",color:"#f5c955",lessons:[
 // CR 1.11.3: 20 or more lore wins. CR 4.5.1: questing exerts and gains the character's lore.
 L("b1","Race to 20","Questing gains lore; 20 lore wins.","lore",
  {me:{lore:17,play:["AURORA","MICKEY"]},opp:{lore:9,play:[{c:"TIBBS",ex:true}]}},
  [{k:"demo",say:"Aurora quests: she turns sideways and you gain 2 lore.",a:q("AURORA")},
   {k:"do",say:"Your turn: quest with Mickey to reach 20.",a:q("MICKEY"),guide:true},
   {k:"pick",say:"What wins the game?",opts:["20 lore","Banish 5 cards","Empty hand"],ans:0}]),
 // CR 4.2.1.1 inkwell symbol; CR 4.2.3 once per turn.
 L("b2","The Inkwell","Ink one inkable card per turn.","ink",
  {me:{hand:["SIMBA","STITCH","TOD"],ink:1}},
  [{k:"do",say:"Simba has no ink symbol. Ink Stitch instead.",a:ink("STITCH"),guide:true},
   {k:"pick",say:"You inked this turn. Can you ink Tod too?",opts:["No, once per turn","Yes, any time"],ans:0},
   {k:"do",say:"New turn, new board: ink the card with the ink symbol.",setup:{me:{hand:["SEBA","PUA"],ink:2}},a:ink("PUA")}]),
 // CR 4.3.2.4 pay by exerting ready ink.
 L("b3","Pay to Play","Exert ink equal to a card's cost.","ink",
  {me:{hand:["POOH","MICKEY"],ink:3}},
  [{k:"do",say:"Play Mickey: watch 3 ink turn sideways.",a:play("MICKEY"),guide:true},
   {k:"pick",say:"Pooh costs 5. Ready ink left?",opts:["0","3","5"],ans:0}]),
 // CR 5.1.1.11 drying; CR 3.2.1.1 ready step; CR 3.2.3.1 draw step.
 L("b4","Drying and Ready","New characters wait a turn; exerted cards ready next turn.","bolt",
  {me:{play:[{c:"STEAM",wet:true},"BALOO"],ink:0,inkEx:3}},
  [{k:"do",say:"Steamboat Mickey is drying. Quest with Baloo.",a:q("BALOO"),guide:true},
   {k:"turn",say:"End turn. Your next turn readies everything and draws a card."},
   {k:"do",say:"Mickey is dry now. Quest with him.",a:q("STEAM")}]),
 // CR 4.6.4.2 exerted targets; CR 4.6 damage both ways; CR 1.9 damage stays, banish at willpower.
 L("b5","Challenge","Challenge exerted rivals; damage stays.","sword",
  {me:{play:["STEAM"]},opp:{play:[{c:"KHAN",ex:true},"HIGGINS"]}},
  [{k:"do",say:"Challenge the exerted Shere Khan with Mickey.",a:chal("STEAM","KHAN"),guide:true},
   {k:"pick",say:"Can you challenge a ready rival like Higgins?",opts:["No, only exerted ones","Yes"],ans:0},
   {k:"do",say:"Baloo already has 2 damage. Finish him with Stitch.",setup:{me:{play:["STITCH"]},opp:{play:[{c:"BALOO",ex:true,dmg:2}]}},a:chal("STITCH","BALOO")}]),
 // CR 5.4.4.2 songs: exert a dry character with cost >= song cost to sing for free.
 L("b6","Songs","A dry character can sing a song instead of paying ink.","note",
  {me:{hand:["WGCM"],play:["MICKEY"],ink:0},opp:{play:["CAULDRON"]}},
  [{k:"do",say:"No ink? Mickey (cost 3) sings this cost 3 song.",a:play("WGCM",{singer:"MICKEY",target:"CAULDRON"}),guide:true},
   {k:"pick",say:"Could a cost 2 character sing it?",opts:["No, cost too low","Yes"],ans:0}]),
 // CR 5.5.4 items usable the turn played; CR 4.7 move; CR 3.2.2.2 location lore at the Set step.
 L("b7","Items and Places","Items stay and work; locations give lore.","box",
  {me:{hand:["SOURCE"],ink:6,lore:3}},
  [{k:"do",say:"Play Source of the Vine (cost 4).",a:play("SOURCE"),guide:true},
   {k:"do",say:"Use it now: exert it and pay 2 ink for 1 lore.",a:use("SOURCE")},
   {k:"do",say:"Move Stitch to Agrabah for 1 ink.",setup:{me:{play:["AGRABAH","STITCH"],ink:1,lore:5}},a:move("STITCH","AGRABAH")},
   {k:"turn",say:"End turn: Agrabah gives you 2 lore at the start of your turn."}]),
 L("b8","Your First Turn","Ink, play, then quest.","star",
  {me:{hand:["AURORA","SIMBA","STITCH"],play:["MICKEY"],ink:1},opp:{lore:4,play:[{c:"HIGGINS",ex:true}]}},
  [{k:"goal",say:"Ink, play Aurora, and quest for 2 lore.",goal:"inked&inplay:AURORA&lore>=2",depth:4}]),
 L("b9","Basics Test","Win this turn.","trophy",
  {me:{lore:15,play:["AURORA","MICKEY","STITCH"]},opp:{lore:18,play:[{c:"HIGGINS",ex:true}]}},
  [{k:"goal",say:"Win this turn. Every lore counts.",goal:"win",depth:4,puzzle:true,key:[q("AURORA"),q("MICKEY"),q("STITCH")]}],{test:true})
]},
{id:"ch2",title:"Keywords: Guard and Strike",desc:"Bodyguard, Evasive, Alert, Ward, Resist, Rush, Challenger, Reckless, Support.",color:"#7cc7ff",lessons:[
 // CR 8.3.3 Bodyguard challenging limiter; 8.3.2 may enter exerted.
 L("k1","Bodyguard","Challenge the Bodyguard first.","shield",
  {me:{play:["STEAM"]},opp:{play:[{c:"NANI",ex:true},{c:"AURORA",ex:true}]}},
  [{k:"do",say:"Nani has Bodyguard, so she is the only legal target.",a:chal("STEAM","NANI"),guide:true},
   {k:"do",say:"Your Hercules has Bodyguard: play him exerted to protect.",setup:{me:{hand:["HERC"],ink:3}},a:play("HERC",{exerted:true})}]),
 // CR 8.6.1 Evasive.
 L("k2","Evasive","Only Evasive can challenge Evasive.","shield",
  {me:{play:["MICKEY","VIOLET"]},opp:{play:[{c:"PEGASUS",ex:true}]}},
  [{k:"pick",say:"Who can challenge Evasive Pegasus?",opts:[{c:"VIOLET"},{c:"MICKEY"}],ans:0},
   {k:"do",say:"Challenge Pegasus with Violet.",a:chal("VIOLET","PEGASUS")}]),
 // CR 8.2.1 Alert ignores Evasive limiters.
 L("k3","Alert","Alert can challenge Evasive characters.","shield",
  {me:{play:["SYNDROME"]},opp:{play:[{c:"FROZONE",ex:true},{c:"PIGLET",ex:true}]}},
  [{k:"demo",say:"Frozone is Evasive, but Syndrome has Alert.",a:chal("SYNDROME","FROZONE")},
   {k:"do",say:"Same trick: Cri-Kee (Alert) hits Evasive Pegasus.",setup:{me:{play:["CRIKEE"]},opp:{play:[{c:"PEGASUS",ex:true}]}},a:chal("CRIKEE","PEGASUS")}]),
 // CR 8.15.1 Ward: opponents can't choose it for effects; challenges still allowed.
 L("k4","Ward","Effects can't choose Ward, but challenges can.","shield",
  {me:{hand:["CANNONS"],play:["STEAM"],ink:1},opp:{play:[{c:"ALADDIN",ex:true},{c:"TOD",ex:true}]}},
  [{k:"do",say:"Fire the Cannons can't pick Aladdin (Ward). Hit Tod.",a:play("CANNONS",{target:"TOD"}),guide:true},
   {k:"do",say:"Ward doesn't stop challenges: challenge Aladdin.",a:chal("STEAM","ALADDIN")}]),
 // CR 8.8.1 Resist reduces damage dealt.
 L("k5","Resist","Resist lowers damage taken.","shield",
  {me:{play:["NAVEEN"]},opp:{play:[{c:"EEYORE",ex:true}]}},
  [{k:"pick",say:"Naveen deals 4. Eeyore has Resist +1. Damage taken?",opts:["3","4","5"],ans:0},
   {k:"do",say:"Challenge and watch 3 damage land.",a:chal("NAVEEN","EEYORE")}]),
 // CR 8.9.1 Rush.
 L("k6","Rush","Rush challenges the turn it's played.","bolt",
  {me:{hand:["HERMES"],ink:3},opp:{play:[{c:"BIGNOSE",ex:true}]}},
  [{k:"do",say:"Play Hermes (Rush).",a:play("HERMES"),guide:true},
   {k:"do",say:"Still drying, but Rush lets him challenge now.",a:chal("HERMES","BIGNOSE")}]),
 // CR 8.5.1 Challenger +N while challenging.
 L("k7","Challenger","Bonus strength while challenging.","sword",
  {me:{play:["IAGO"]},opp:{play:[{c:"MUSHU",ex:true}]}},
  [{k:"pick",say:"Iago: 0 strength, Challenger +5. Damage to Mushu?",opts:["5","0","4"],ans:0},
   {k:"do",say:"Send Iago in.",a:chal("IAGO","MUSHU")}]),
 // CR 8.7.2 Reckless can't quest; 8.7.3 can't end turn while it can challenge.
 L("k8","Reckless","Reckless can't quest and must challenge.","sword",
  {me:{play:["GASTON"]},opp:{play:[{c:"HIGGINS",ex:true}]}},
  [{k:"do",say:"Gaston is Reckless: he can't quest. Challenge Higgins.",a:chal("GASTON","HIGGINS"),guide:true},
   {k:"pick",say:"Could you have ended the turn without challenging?",opts:["No, Reckless must challenge if able","Yes"],ans:0}]),
 // CR 8.13.1 Support adds strength when questing.
 L("k9","Support","Questing with Support powers up a friend.","star",
  {me:{play:["MULAN","STITCH"]},opp:{play:[{c:"MUSHU",ex:true}]}},
  [{k:"do",say:"Quest with Mulan: Support gives Stitch +2 strength.",a:q("MULAN"),guide:true},
   {k:"do",say:"Stitch now has 4 strength: banish Mushu.",a:chal("STITCH","MUSHU")}]),
 L("k10","Keyword Test","Get past Bodyguard and Ward.","trophy",
  {me:{hand:["CANNONS"],play:["STITCH"],ink:1},opp:{lore:12,play:[{c:"NANI",ex:true,dmg:4},{c:"KAA",ex:true}]}},
  [{k:"goal",say:"Banish Kaa this turn.",goal:"banish:KAA",depth:3,puzzle:true,key:[play("CANNONS",{target:"NANI"}),chal("STITCH","KAA")]}],{test:true})
]},
{id:"ch3",title:"Shift and Song Math",desc:"Shift, Singer N, Sing Together, and saving ink.",color:"#ff9ecb",lessons:[
 // CR 8.10.1 Shift alternate cost; 8.10.4 shifted onto a dry character is dry.
 L("s1","Shift","Pay Shift to play on a same-name character.","bolt",
  {me:{hand:["SHANG2"],play:["SHANG1"],ink:4}},
  [{k:"do",say:"Shift Valiant Leader onto Li Shang for 4, not 7.",a:play("SHANG2",{shift:"SHANG1"}),guide:true},
   {k:"do",say:"Shifted onto a dry card, he's dry: quest now.",a:q("SHANG2")}]),
 // CR 8.10.2 exerted base -> enters exerted; 8.10.6 keeps damage.
 L("s2","Shift Keeps State","A shifted card keeps exert and damage.","bolt",
  {me:{hand:["SHANG2"],play:[{c:"SHANG1",ex:true,dmg:2}],ink:4}},
  [{k:"pick",say:"Shift onto an exerted Li Shang with 2 damage. Result?",opts:["Exerted, 2 damage","Ready, no damage"],ans:0},
   {k:"do",say:"Shift and check.",a:play("SHANG2",{shift:"SHANG1"})}]),
 // CR 8.11.1 Singer N.
 L("s3","Singer","Singer N sings songs up to cost N.","note",
  {me:{hand:["BEKING"],play:["URSULA"],ink:0},opp:{play:["KHAN","TOD"]}},
  [{k:"do",say:"Ursula costs 2 but has Singer 4: sing Be King Undisputed.",a:play("BEKING",{singer:"URSULA"}),guide:true}]),
 L("s4","Pick the Singer","Match Singer value to song cost.","note",
  {me:{hand:["PIRATE"],play:["POWERLINE","ARIEL","MICKEY"],ink:0},opp:{lore:6}},
  [{k:"pick",say:"A Pirate's Life costs 6. Who can sing it alone?",opts:[{c:"ARIEL"},{c:"POWERLINE"},{c:"MICKEY"}],ans:0},
   {k:"do",say:"Sing it with Ariel.",a:play("PIRATE",{singer:"ARIEL"})}]),
 // CR 8.12.2 Sing Together adds costs.
 L("s5","Sing Together","Several singers add their costs.","note",
  {me:{hand:["PIRATE"],play:["MICKEY","DAISY"],ink:0},opp:{lore:9}},
  [{k:"do",say:"Mickey 3 + Daisy 3 = 6: sing A Pirate's Life together.",a:play("PIRATE",{singers:["MICKEY","DAISY"]}),guide:true}]),
 // CR 5.4.4.2 singing is an alternate cost: ink stays free for other cards.
 L("s6","Sing to Save Ink","Sing the song, spend ink on a character.","ink",
  {me:{hand:["HEAL","MICKEY"],play:[{c:"STEAM",dmg:2}],ink:3,deck:20}},
  [{k:"goal",say:"Play both cards this turn.",goal:"inplay:MICKEY&plays>=2",depth:3,puzzle:true,key:[play("HEAL",{singer:"STEAM"})]}]),
 // CR 5.1.1.11 drying characters can't sing.
 L("s7","Dry Singers Only","A drying character can't sing.","note",
  {me:{hand:["WGCM"],play:[{c:"ARIEL",wet:true},"MICKEY"],ink:0},opp:{play:["COWS"]}},
  [{k:"pick",say:"Ariel was just played. Who can sing?",opts:[{c:"MICKEY"},{c:"ARIEL"}],ans:0},
   {k:"do",say:"Sing it with Mickey to banish Space Cows.",a:play("WGCM",{singer:"MICKEY",target:"COWS"})}]),
 L("s8","Shift Test","Shift in, then strike.","trophy",
  {me:{hand:["SHANG2"],play:["SHANG1"],ink:4},opp:{lore:14,play:[{c:"CAULDRON",ex:true}]}},
  [{k:"goal",say:"Banish Cauldron Born (7 willpower) this turn.",goal:"banish:CAULDRON",depth:3,puzzle:true,key:[play("SHANG2",{shift:"SHANG1"}),chal("SHANG2","CAULDRON")]}],{test:true})
]},
{id:"ch4",title:"Items and Locations",desc:"Engines, cost cuts, moving, and place lore.",color:"#8ef0b3",lessons:[
 L("i1","Cost Cutter","Use an item to play more this turn.","box",
  {me:{hand:["LANTERN","MICKEY"],ink:4}},
  [{k:"goal",say:"Play Lantern and Mickey with only 4 ink.",goal:"plays>=2",depth:3,puzzle:true,key:[use("LANTERN")]}]),
 L("i2","Draw Engine","Items can turn ink into cards.","box",
  {me:{play:["MIRROR"],hand:["SIMBA"],ink:4}},
  [{k:"do",say:"Use Magic Mirror: exert it and pay 4 to draw.",a:use("MIRROR"),guide:true},
   {k:"pick",say:"Why use it at the end of a turn?",opts:["Spare ink becomes a card","It costs less then"],ans:0}]),
 // CR 3.2.2.2 location lore at Set step.
 L("i3","Place Lore","Locations give lore at the start of your turn.","pin",
  {me:{hand:["FATCAT"],ink:3,lore:8}},
  [{k:"do",say:"Play Fat Cat's Club.",a:play("FATCAT"),guide:true},
   {k:"turn",say:"End turn and collect its 2 lore."}]),
 // CR 4.7: moving doesn't exert.
 L("i4","Move, Then Quest","Moving doesn't exert.","pin",
  {me:{play:["AGRABAH","DAISY"],ink:1,lore:4}},
  [{k:"do",say:"Move Daisy to Agrabah.",a:move("DAISY","AGRABAH"),guide:true},
   {k:"do",say:"She's still ready: quest from there.",a:q("DAISY")}]),
 L("i5","Place Bonus","A location's bonus can win a fight.","pin",
  {me:{play:["COVE","STITCH"],ink:1},opp:{play:[{c:"KHAN",ex:true}]}},
  [{k:"goal",say:"Banish Shere Khan and keep Stitch alive.",goal:"banish:KHAN&alive:STITCH",depth:3,puzzle:true,key:[move("STITCH","COVE")]}]),
 // CR 4.6: locations can be challenged; they deal no damage back.
 L("i6","Siege a Place","Challenge locations to stop their lore.","sword",
  {me:{play:["NAVEEN","STITCH"]},opp:{play:["FATCAT"],lore:11}},
  [{k:"demo",say:"Naveen hits the Club for 4. Places don't hit back.",a:chal("NAVEEN","FATCAT")},
   {k:"do",say:"Finish it with Stitch.",a:chal("STITCH","FATCAT")}]),
 L("i7","Item Finish","Use every lore source.","star",
  {me:{lore:18,play:["SOURCE","STITCH"],ink:2},opp:{lore:15}},
  [{k:"goal",say:"Two lore short. Find both points.",goal:"win",depth:3,puzzle:true,key:[use("SOURCE"),q("STITCH")]}]),
 L("i8","Places Test","Survive: stop their next-turn lore.","trophy",
  {me:{play:["NAVEEN","STITCH"],lore:10},opp:{lore:17,play:["FATCAT","HIGGINS"]}},
  [{k:"goal",say:"Survive: rival must not reach 20 next turn.",goal:"oppMax<20",depth:3,puzzle:true,key:[chal("NAVEEN","FATCAT"),chal("STITCH","FATCAT")]}],{test:true})
]},
{id:"ch5",title:"The Lore Race",desc:"Count turns, trade well, and plan the opening.",color:"#c9a7ff",lessons:[
 L("r1","Count the Race","Count lore each side gains per turn.","lore",
  {me:{lore:12,play:["STITCH"]},opp:{lore:15,play:["AURORA","DAISY"]}},
  [{k:"pick",say:"Rival gains 5 a turn from 15. Turns to win?",opts:["1","2","3"],ans:0}]),
 L("r2","Stop the Big Quester","Remove the lore that beats you.","sword",
  {me:{lore:10,play:["STEAM"]},opp:{lore:17,play:[{c:"AURORA",ex:true},{c:"DAISY",ex:true}]}},
  [{k:"goal",say:"Survive: rival is at 17.",goal:"oppMax<20",depth:2,puzzle:true,key:[chal("STEAM","DAISY")]}]),
 L("r3","Trade Up","Banish their most expensive card.","sword",
  {me:{play:["NAVEEN"]},opp:{play:[{c:"KATRINA",ex:true},{c:"HIGGINS",ex:true},{c:"PUA",ex:true}]}},
  [{k:"pick",say:"Naveen (cost 3) can banish one. Best trade?",opts:[{c:"KATRINA"},{c:"HIGGINS"},{c:"PUA"}],ans:0},
   {k:"do",say:"Trade up: challenge Katrina.",a:chal("NAVEEN","KATRINA")}]),
 L("r4","Survive This Turn","Find the removal that matters.","shield",
  {me:{hand:["CANNONS"],play:["NAVEEN","STITCH"],ink:1,lore:9},opp:{lore:17,play:[{c:"AURORA",ex:true},{c:"MICKEY",ex:true},"DAISY"]}},
  [{k:"goal",say:"Rival at 17 with 7 lore on board. Survive.",goal:"oppMax<20",depth:3,puzzle:true,key:[play("CANNONS",{target:"DAISY"})]}]),
 L("r5","Order Matters","Sequence the turn to win.","star",
  {me:{lore:14,hand:["SCOUT"],play:["MULAN","STITCH","SOURCE"],ink:3},opp:{lore:17}},
  [{k:"goal",say:"Win this turn. Order matters.",goal:"win",depth:5,puzzle:true,key:[play("SCOUT"),use("SOURCE"),q("MULAN"),q("STITCH")]}]),
 // CR 2.2.2 mulligan: put any number on the bottom, draw that many.
 L("r6","Mulligan","Send back cards you can't use early.","deck",
  {me:{}},
  [{k:"pick",say:"Opening hand: tap the 2 cards to send back.",multi:true,opts:[{c:"TIBBS"},{c:"CHIEN"},{c:"STITCH"},{c:"COWS"},{c:"MICKEY"}],ans:[1,3]}]),
 L("r7","What to Ink","Ink the card you need least.","ink",
  {me:{hand:["MICKEY","CHIEN","SIMBA"],ink:2}},
  [{k:"pick",say:"Turn 3 plan: play Mickey. Which card do you ink?",opts:[{c:"CHIEN"},{c:"MICKEY"},{c:"SIMBA"}],ans:0},
   {k:"do",say:"Ink Chien-Po, then you have 3 for Mickey.",a:ink("CHIEN")},
   {k:"do",say:"Now play Mickey.",a:play("MICKEY")}]),
 L("r8","Legal Decks","60 cards, up to 2 inks, 4 copies max.","deck",
  {me:{}},
  [{k:"pick",say:"Which deck is tournament legal?",opts:["60 cards, 2 inks, 4 copies max","59 cards, 1 ink","60 cards, 3 inks","60 cards, 5 copies of one card"],ans:0}]),
 L("r9","Race Final","Quest or challenge? Find the only win.","trophy",
  {me:{lore:16,play:["MULAN","STITCH","NAVEEN"]},opp:{lore:18,play:[{c:"NANI",ex:true},{c:"DAISY",ex:true}]}},
  [{k:"goal",say:"Rival is at 18. Take the win now.",goal:"win",depth:4,puzzle:true,key:[q("MULAN"),q("STITCH"),q("NAVEEN")]}],{test:true})
]}];
const SOON=[["Tempo","Use every ink, every turn."],["Removal","Spend answers on the right threat."],["Ink and Curve","Plan turns 1 to 5."],["Card Advantage","Win the long game."],["Reading the Board","See their best line first."],["Playing Around","Dodge songs and removal."],["Win This Turn","Multi-move puzzles."],["Pro Lines I","Champion-level turns."],["Pro Lines II","Final chapter."],["Graduation","Everything together."]];
SOON.forEach(([t,d],i)=>chapters.push({id:"ch"+(6+i),title:t,desc:d,color:["#ffb37c","#8ef0e6","#f28b82","#aecbfa","#d7aefb","#93e6a0","#f9ab78","#7cc7ff","#f5c955","#ff9ecb"][i],soon:true,lessons:[]}));
return{version:2,cards:C,chapters}})();
if(typeof window!=='undefined')window.LEARN_DATA=LEARN_DATA;
if(typeof module!=='undefined'&&module.exports)module.exports=LEARN_DATA;
