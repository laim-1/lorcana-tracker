"""Generate js/learn-data.js. Example cards are picked ONLY from sets 9-14
present in data/game-cards.js (verified: sets 9-13 have data; set 14 has none
in this repo, so no set-14 example is invented). Run: python3 tools/gen-learn-data.py"""
import json, pathlib
root=pathlib.Path(__file__).resolve().parent.parent
g=(root/'data/game-cards.js').read_text()
gj=json.loads(g[g.index('=')+1:].rstrip(';'))
pool=[c for c in gj['cards'] if str(c.get('set')) in ('9','10','11','12','13','14')]
pool.sort(key=lambda c:(int(c['set']), c.get('cost') or 0, c['name']))
def has(kw,c): return kw.lower() in (c.get('text') or '').lower()
def typ(t,c): return c.get('type')==t
TAGS={
 'character': lambda c: typ(['Character'],c),
 'charLore2': lambda c: typ(['Character'],c) and (c.get('lore') or 0)>=2,
 'charCheap': lambda c: typ(['Character'],c) and (c.get('cost') or 9)<=2,
 'charBig': lambda c: typ(['Character'],c) and (c.get('cost') or 0)>=5,
 'inkable': lambda c: bool(c.get('inkwell')),
 'nonink': lambda c: not c.get('inkwell'),
 'song': lambda c: typ(['Action','Song'],c),
 'action': lambda c: typ(['Action'],c),
 'item': lambda c: typ(['Item'],c),
 'location': lambda c: typ(['Location'],c),
 'evasive': lambda c: has('Evasive',c) and typ(['Character'],c),
 'bodyguard': lambda c: has('Bodyguard',c) and typ(['Character'],c),
 'ward': lambda c: has('Ward',c) and typ(['Character'],c),
 'resist': lambda c: has('Resist',c) and typ(['Character'],c),
 'rush': lambda c: has('Rush',c) and typ(['Character'],c),
 'challenger': lambda c: has('Challenger',c) and typ(['Character'],c),
 'support': lambda c: has('Support',c) and typ(['Character'],c),
 'reckless': lambda c: has('Reckless',c) and typ(['Character'],c),
 'shift': lambda c: has('Shift',c) and typ(['Character'],c),
 'singer': lambda c: has('Singer',c) and typ(['Character'],c),
 'alert': lambda c: has('Alert',c) and typ(['Character'],c),
 'boost': lambda c: has('Boost',c) and typ(['Character'],c),
 'draw': lambda c: 'draw' in (c.get('text') or '').lower(),
}
# (title, desc, topic, tag)
CH=[
 ("First Steps","Reach 20 lore and learn the turn.",[
  ("The Goal: 20 Lore","First to 20 lore wins the game.","goal","charLore2"),
  ("Your Turn, Step by Step","Ready, draw, then take actions.","turn","character"),
  ("Ready and Exerted","Ready is upright. Exerted is turned.","ready","character"),
  ("Meet Your Characters","Cost, strength, willpower and lore.","stats","character"),
  ("What Is Lore?","Quest to move your lore counter up.","lore","charLore2"),
  ("Cards in Your Hand","You start with 7 cards. Protect them.","hand","charCheap"),
  ("Winning and Losing","20 lore wins. An empty deck can lose.","win","charBig"),
  ("Your First Plan","Decide your main play before you tap.","plan","character"),
  ("Chapter 1 Test","Mixed review and a guided quest.","test","charLore2")]),
 ("The Inkwell","Ink is how you pay for everything.",[
  ("What Is Ink?","One ink per turn grows your inkwell.","ink","inkable"),
  ("Inkable Cards","The ink drop symbol means it can be inked.","inkable","inkable"),
  ("Cards You Cannot Ink","No symbol? It must stay for playing.","nonink","nonink"),
  ("Paying Costs","Exert ink equal to the card cost.","pay","inkable"),
  ("Ink Early, Win Later","Early ink makes bigger turns possible.","inkearly","charCheap"),
  ("Which Card Do I Ink?","Ink the card you need least right now.","inkchoice","character"),
  ("Ink and Your Hand Size","Inking spends a card. Think first.","inkhand","character"),
  ("Saving a Key Card","Do not ink the card your plan needs.","inksave","charBig"),
  ("Chapter 2 Test","Ink choices and a guided ink play.","test","inkable")]),
 ("Playing Characters","Get characters into play, ready to act.",[
  ("Pay and Play","Pay the cost, put the character in play.","play","charCheap"),
  ("Drying Ink","New characters wait a turn to quest.","drying","character"),
  ("When Can They Quest?","They must be dry and ready.","dryquest","character"),
  ("When Can They Challenge?","Dry, ready, and not held back.","drychal","character"),
  ("Cheap Characters First","Small costs fill your early board.","cheap","charCheap"),
  ("Big Characters","High cost, high impact. Plan your ink.","big","charBig"),
  ("Two Characters or One?","Spend your ink where it helps most.","playchoice","character"),
  ("Protect Your Hand","Do not play everything without a reason.","playhand","character"),
  ("Chapter 3 Test","Play a character the guided way.","test","character")]),
 ("Questing for Lore","Questing is how most games are won.",[
  ("Quest: Exert for Lore","Exert a dry character to gain its lore.","quest","charLore2"),
  ("Lore on the Card","The diamond number is lore gained.","queststat","charLore2"),
  ("Quest or Wait?","Exerted characters can be challenged.","questrisk","charLore2"),
  ("The Lore Race","Count both lore totals every turn.","race","charLore2"),
  ("Questing Every Turn","Steady lore adds up fast.","queststeady","character"),
  ("When NOT to Quest","Sometimes a challenge matters more.","questno","character"),
  ("Finish the Game","At 19 lore, one more point wins.","finish","charLore2"),
  ("Locations Can Help","Some places add lore or protect questers.","questloc","location"),
  ("Chapter 4 Test","Guided questing on a tiny board.","test","charLore2")]),
 ("Challenging","Trade strength against willpower.",[
  ("What Is a Challenge?","Exert to challenge an exerted rival.","challenge","character"),
  ("Only Exerted Targets","Ready characters cannot be challenged.","chaltarget","character"),
  ("Strength Hits Back","Both characters deal strength damage.","chalboth","character"),
  ("Reading the Board","Tap the exerted character you can face.","chalboard","character"),
  ("Safe Challenges","Pick fights your character survives.","chalsafe","character"),
  ("Bad Challenges","Do not trade down without a plan.","chalbad","character"),
  ("Challenge to Slow Them","Remove their best quester.","chalwhy","charLore2"),
  ("Evasive Targets","Some characters are hard to challenge.","chalevasive","evasive"),
  ("Chapter 5 Test","Guided challenge on a tiny board.","test","character")]),
 ("Damage and Banishing","Willpower is a character's health.",[
  ("Damage Stays","Damage stays until healed or banished.","damage","character"),
  ("Willpower","Damage equal to willpower banishes.","willpower","character"),
  ("Banished Goes to Discard","Banished cards leave play.","banish","character"),
  ("Damage Math","Strength versus remaining willpower.","dmgmath","character"),
  ("Healing","Removing damage keeps characters alive.","heal","draw"),
  ("Resist Preview","Some characters reduce damage taken.","resistprev","resist"),
  ("Finishing a Damaged Rival","Small hits can finish weak characters.","dmgfinish","character"),
  ("Do Not Waste Damage","Aim damage where it changes the board.","dmgplan","character"),
  ("Chapter 6 Test","Damage math and a guided challenge.","test","character")]),
 ("Songs and Singers","Sing for free with the right character.",[
  ("What Is a Song?","Songs are actions with a music note cost.","song","song"),
  ("Singing for Free","A character of equal cost can sing it.","sing","song"),
  ("Singer","Singer counts as a higher cost to sing.","singer","singer"),
  ("Sing Together","Several characters can combine to sing.","singtogether","song"),
  ("Pay Ink or Sing?","Singing saves ink for other plays.","singchoice","song"),
  ("Dry Singers Only","A singer must be dry and ready.","singdry","singer"),
  ("Songs That Draw","Songs can refill your hand.","songdraw","song"),
  ("Songs That Remove","Some songs answer big threats.","songremove","song"),
  ("Chapter 7 Test","Sing a song in guided practice.","test","song")]),
 ("Actions","One-time effects that change the turn.",[
  ("What Is an Action?","Play it, follow it, discard it.","action","action"),
  ("Actions That Draw","More cards means more choices.","actiondraw","action"),
  ("Actions That Damage","Clear a path or finish a rival.","actiondmg","action"),
  ("Actions That Banish","Remove a threat for good.","actionbanish","action"),
  ("Actions That Bounce","Return a card to its owner's hand.","actionbounce","action"),
  ("When to Hold an Action","Wait for the best target.","actionhold","action"),
  ("Actions and Ink","Every action competes for your ink.","actionink","action"),
  ("Reading Action Text","Do exactly what the card says, in order.","actionread","action"),
  ("Chapter 8 Test","Pick the right action moment.","test","action")]),
 ("Items","Tools that stay in play.",[
  ("What Is an Item?","Items stay until banished or used up.","item","item"),
  ("Items With Abilities","Exert or pay ink to use many items.","itemuse","item"),
  ("Items That Draw","Trade ink now for cards later.","itemdraw","item"),
  ("Protective Items","Items can boost or shield characters.","itemprotect","item"),
  ("One-Time Items","Some items banish themselves to work.","itemsac","item"),
  ("Is This Item Worth It?","Compare its cost to what it does.","itemvalue","item"),
  ("Items and Characters","The right item on the right character.","itemcombo","item"),
  ("Answering Rival Items","Remove items that keep helping them.","itemanswer","item"),
  ("Chapter 9 Test","Use an item plan in practice.","test","item")]),
 ("Locations and Moving","Places your characters can visit.",[
  ("What Is a Location?","Locations stay in play like items.","location","location"),
  ("Move Cost","Pay ink to move a character there.","movecost","location"),
  ("Lore From Locations","Some locations give lore each turn.","loclore","location"),
  ("Bonuses While Here","Characters can gain power at a place.","locbonus","location"),
  ("Challenging Locations","Locations have willpower too.","locchal","location"),
  ("When to Move","Move only when the bonus matters.","movewhen","location"),
  ("Free Moves","Some cards let characters move free.","movefree","location"),
  ("Location Plans","Build a turn around one strong place.","locplan","location"),
  ("Chapter 10 Test","Move and quest in guided practice.","test","location")]),
 ("Keywords I","Bodyguard, Evasive, Ward and Resist.",[
  ("Bodyguard","Enter exerted to protect your team.","bodyguard","bodyguard"),
  ("Facing a Bodyguard","You must challenge Bodyguard first.","bodyguardface","bodyguard"),
  ("Evasive","Only Evasive characters can challenge it.","evasive","evasive"),
  ("Ward","Opponents cannot choose it except to challenge.","ward","ward"),
  ("Resist","Resist reduces damage this character takes.","resist","resist"),
  ("Alert","Alert can challenge as if it had Evasive.","alert","alert"),
  ("Boost","Pay to tuck a card under a Boost character.","boost","boost"),
  ("Keyword Match-Up","Tap the keyword that fits the board.","kwmatch1","evasive"),
  ("Chapter 11 Test","Keyword quiz and board taps.","test","bodyguard")]),
 ("Keywords II","Rush, Challenger, Support, Reckless, Shift.",[
  ("Rush","Rush can challenge the turn it is played.","rush","rush"),
  ("Challenger","Challenger gets bonus strength attacking.","challenger","challenger"),
  ("Support","Support adds strength when questing.","support","support"),
  ("Reckless","Reckless must challenge if it can.","reckless","reckless"),
  ("Shift","Shift plays on top of the same name.","shift","shift"),
  ("Shift Saves Ink","Shift is often cheaper than full cost.","shiftcheap","shift"),
  ("Singer Revisited","Big voices sing big songs for free.","singer2","singer"),
  ("Keyword Match-Up II","Match the keyword to the job.","kwmatch2","rush"),
  ("Chapter 12 Test","Keyword quiz and guided Rush play.","test","shift")]),
 ("Draw, Tempo and the Race","Cards and turns are resources too.",[
  ("Drawing Cards","Draw at the start of most turns.","drawcard","draw"),
  ("Hand Size Matters","More options, better turns.","handsize","draw"),
  ("Deck and Discard","Know what is left and what is gone.","deckknow","draw"),
  ("Tempo","Use every ink, every turn if you can.","tempo","character"),
  ("The Lore Race, Counted","How many turns until each side wins?","racecount","charLore2"),
  ("Trading Cards","A trade is good if you gain more.","tradevalue","character"),
  ("Running Low","When cards run low, protect each one.","lowcards","draw"),
  ("Comeback Turns","Draw and removal can swing a game.","comeback","action"),
  ("Chapter 13 Test","Race counting and card choices.","test","draw")]),
 ("Deck Building and Mulligan","Build 60 cards in 2 inks.",[
  ("60 Cards, 2 Inks","A legal deck: 60 cards, at most 2 inks.","deck60","character"),
  ("The 4-Copy Rule","At most 4 copies of one full card name.","copies","character"),
  ("Inkable Count","Most decks want many inkable cards.","deckink","inkable"),
  ("The Cost Curve","Cheap, middle and big cards in balance.","curve","charCheap"),
  ("Characters Win Games","You need enough questers.","deckchars","charLore2"),
  ("Songs, Items, Locations","Support cards need characters first.","deckmix","item"),
  ("The Mulligan","Send back cards you cannot use early.","mulligan","charCheap"),
  ("Keeping a Hand","Keep ink and early plays.","keephand","inkable"),
  ("Chapter 14 Test","Judge hands and deck rules.","test","character")]),
 ("Pro Play","Plan the whole turn like a champion.",[
  ("Plan Before You Tap","Order: ink, play, quest, challenge.","proplan","character"),
  ("Quest or Challenge?","The hardest choice, made with math.","prochoice","charLore2"),
  ("Counting the Race","Exact turns to 20 for both players.","procount","charLore2"),
  ("Playing Around Songs","Do not line up into their best song.","prosongs","song"),
  ("Playing Around Removal","Keep a backup threat ready.","proremoval","action"),
  ("Late-Game Ink","Ink only if a future turn needs it.","proink","inkable"),
  ("Trading Smart","Trade up, protect your best quester.","protrade","character"),
  ("The Final Turn","Find the exact line to 20 lore.","profinal","charLore2"),
  ("Graduation Test","Everything together. Earn the trophy.","test","charLore2")]),
]
out=[]
counters={k:0 for k in TAGS}
for ci,(ctitle,cdesc,lessons) in enumerate(CH):
    ls=[]
    for li,(t,d,topic,tag) in enumerate(lessons):
        lst=[c for c in pool if TAGS[tag](c)]
        if not lst: raise SystemExit(f"no cards for {tag}")
        c=lst[counters[tag]%len(lst)]; counters[tag]+=1
        is_test = li==len(lessons)-1
        ls.append({"id":f"c{ci+1}l{li+1}","title":t,"desc":d,"topic":topic,"tag":tag,
                   "exampleId":c["id"],"exampleName":c["name"]+((" - "+c["version"]) if c.get("version") else ""),
                   "exampleSet":str(c["set"]),"xp":20 if is_test else 10,"test":is_test})
    out.append({"id":f"ch{ci+1}","title":ctitle,"desc":cdesc,"color":["#f5c955","#7cc7ff","#ff9ecb","#8ef0b3","#c9a7ff","#ffb37c","#8ef0e6","#f28b82","#aecbfa","#d7aefb","#93e6a0","#f9ab78","#7cc7ff","#f5c955","#ff9ecb"][ci],"lessons":ls})
data={"version":1,"note":"Examples only from sets 9-14 present in data/game-cards.js. Repo data currently contains sets 9-13; set 14 (Hyperia City) has no card data in the app yet, so no set-14 card is used or invented. Keywords taught are only those verified in sets 9-13 data: Shift, Singer, Bodyguard, Evasive, Rush, Resist, Ward, Support, Challenger, Reckless, Alert, Boost.","chapters":out}
js="/* Generated by tools/gen-learn-data.py - do not hand-edit example ids. */\nvar LEARN_DATA="+json.dumps(data,separators=(',',':'))+";\nif(typeof window!=='undefined')window.LEARN_DATA=LEARN_DATA;\nif(typeof module!=='undefined'&&module.exports)module.exports=LEARN_DATA;\n"
(root/'js/learn-data.js').write_text(js)
print(f"chapters={len(out)} lessons={sum(len(c['lessons']) for c in out)} pool9-14={len(pool)} sets={sorted(set(c['set'] for c in pool))}")
