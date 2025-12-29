/**
 * Kill command scenarios - 50 success and 50 failure scenarios
 * Each scenario is 3-5 sentences telling a dramatic story
 */

const SUCCESS_SCENARIOS = [
  {
    emoji: "🗡️",
    text: "Under the cover of darkness, you tracked {target} through the winding alleys of the city. They turned a corner, unaware of your presence. Your blade struck true before they could even scream. As they fell, their coin purse spilled open - {amount} coins now belong to you. The streets whisper of your ruthlessness."
  },
  {
    emoji: "💣",
    text: "You spent days planning the perfect ambush, studying {target}'s every move. When they entered the abandoned warehouse, you detonated the explosives. The explosion echoed through the district as you walked away without looking back. {amount} coins recovered from the rubble - a fitting reward for your patience."
  },
  {
    emoji: "🎯",
    text: "From a rooftop 300 meters away, you steadied your breathing and lined up the shot. {target} never knew what hit them - one perfect headshot. You packed up your rifle and disappeared into the crowd below. Their {amount} coins transferred to an offshore account. Clean, professional, untraceable."
  },
  {
    emoji: "🔪",
    text: "You waited in {target}'s apartment, sitting in the darkness. When they walked through the door, you were already behind them. One swift motion, and it was over before they could react. You searched their belongings and found {amount} coins hidden in a safe. Amateur mistake - they should have been more careful."
  },
  {
    emoji: "☠️",
    text: "The poison took exactly 30 seconds to work, just as planned. {target} clutched their throat, eyes wide with realization. You watched from across the restaurant as they collapsed. Later that night, you accessed their accounts and transferred {amount} coins. They never saw you coming, and they never will again."
  },
  {
    emoji: "⚔️",
    text: "The duel was over in three moves. {target} thought they were skilled, but you've trained for years. Your blade danced past their defense, finding its mark with surgical precision. As they fell to their knees, you claimed your prize - {amount} coins, rightfully won in honorable combat."
  },
  {
    emoji: "🔫",
    text: "You kicked down the door, weapon drawn. {target} reached for their gun but you were faster - always faster. Two shots rang out in the quiet night. You holstered your weapon and searched the room, finding {amount} coins stashed under the floorboards. Another job well done."
  },
  {
    emoji: "🎭",
    text: "You had been playing the long game, gaining {target}'s trust over months. Tonight, they invited you to their home, completely unsuspecting. The smile never left your face as you made your move. By morning, you were gone with their {amount} coins, and they would never trust anyone again."
  },
  {
    emoji: "⚡",
    text: "The lightning strike was instant and devastating. {target} never felt a thing as thousands of volts coursed through them. You disconnected the modified electrical trap and pocketed the device. Their {amount} coins now sit in your account. Technology is a beautiful thing when wielded correctly."
  },
  {
    emoji: "🌙",
    text: "Under the full moon, you stalked your prey through the forest. {target} heard something and spun around, but saw only shadows. That's when you struck from above, dropping from the trees. By the time dawn broke, you were already spending their {amount} coins at the tavern."
  },
  {
    emoji: "🎪",
    text: "The circus was in town, providing perfect cover. You approached {target} in the crowd, disguised as a performer. One sleight of hand later, they were on the ground and the crowd thought it was part of the act. You bowed, collected your 'tip' of {amount} coins, and vanished into the performance."
  },
  {
    emoji: "🏴‍☠️",
    text: "On the high seas, there's no law but the pirate's code. You challenged {target} to a duel on the deck. They accepted, thinking they had the advantage. But the ocean has taught you well - one slip, one splash, and {amount} coins became yours. The crew cheered your victory."
  },
  {
    emoji: "🎲",
    text: "The rigged game was going perfectly. {target} thought they were winning, betting higher and higher. Then you revealed your cards - and your blade. They realized too late it wasn't just their coins at stake tonight. You walked away with {amount} coins and a reputation for playing for keeps."
  },
  {
    emoji: "🦅",
    text: "From your sniper's nest, you had the perfect view. {target} was giving a speech, completely exposed. One deep breath, one gentle squeeze of the trigger. The shot echoed across the square. Later, their estate was mysteriously liquidated - {amount} coins deposited into an anonymous account."
  },
  {
    emoji: "🌊",
    text: "You lured {target} to the docks, promising a lucrative deal. When they leaned over to inspect the crate, you made your move. The splash was barely audible over the waves. You sold their belongings and pocketed {amount} coins. The sea keeps its secrets well."
  },
  {
    emoji: "🎯",
    text: "The tournament was the perfect cover. Everyone expected casualties in the arena. {target} never stood a chance against your trained reflexes. The crowd roared as you claimed victory - and their {amount} coins. Glory and gold, just as you planned."
  },
  {
    emoji: "🕷️",
    text: "The rare spider venom cost a fortune, but it was worth every coin. You slipped it into {target}'s drink at the gala. They made it three steps before collapsing. You expressed concern to the crowd, but inside you smiled - {amount} coins richer and no one suspects a thing."
  },
  {
    emoji: "🎪",
    text: "You trained for months to perfect the trapeze act. When {target} came to see the show, you made them your volunteer. The 'accident' looked so realistic - even you were impressed. Their next of kin never questioned it, and their {amount} coins transferred smoothly to your account."
  },
  {
    emoji: "🗝️",
    text: "Breaking into {target}'s vault was child's play for someone of your skills. You disabled the security system and opened the safe in under two minutes. But why just steal when you can eliminate the problem entirely? One silenced shot, {amount} coins, and a clean escape."
  },
  {
    emoji: "🎨",
    text: "The art gallery opening provided sophisticated cover. You approached {target} to discuss the paintings, casually brushing against them. The needle was so thin they barely felt it. Hours later, as they slept for the last time, you emptied their accounts - {amount} coins, untraceable."
  },
  {
    emoji: "🏔️",
    text: "The mountain expedition was supposed to be routine. But accidents happen at high altitude, don't they? {target} slipped - or were they pushed? - and tumbled down the cliff face. You reported the tragedy and claimed their emergency funds: {amount} coins. Nature can be so cruel."
  },
  {
    emoji: "🎪",
    text: "As a magician, misdirection is your specialty. {target} volunteered for the disappearing act. The audience gasped as you made them vanish - permanently. While everyone applauded, you quietly collected your payment: their {amount} coins. The show must go on."
  },
  {
    emoji: "⚗️",
    text: "Chemistry was always your best subject. The compound you created was odorless, tasteless, and absolutely lethal. {target} dined well that evening - their last meal. You inherited their business dealings and discovered {amount} coins in hidden accounts. Science prevails."
  },
  {
    emoji: "🎯",
    text: "The crossbow bolt flew silently through the night air. {target} was reading by the window, completely unaware. One perfect shot through the glass, and the book fell from their hands. You retrieved the bolt, left no trace, and claimed {amount} coins from their estate."
  },
  {
    emoji: "🚁",
    text: "The helicopter ride was supposed to be scenic. At 5,000 feet, {target} was admiring the view when the door 'accidentally' opened. No parachute, no witnesses, no problem. You landed smoothly and transferred their {amount} coins before filing the incident report. Pilot error, so tragic."
  },
  {
    emoji: "🎭",
    text: "Playing both sides was exhausting but profitable. You convinced {target} you were their ally while secretly working for their enemies. When they finally let their guard down, you struck. Their {amount} coins now fund your early retirement. Trust is such a fragile thing."
  },
  {
    emoji: "🔬",
    text: "The lab 'accident' was meticulously planned. {target} was so focused on their experiment, they never noticed you tamper with the equipment. The explosion was spectacular. Authorities ruled it accidental, and you quietly claimed their research funds: {amount} coins. Tragic loss for science."
  },
  {
    emoji: "🎪",
    text: "The lion tamer act required years of training. {target} thought the cage was secure during their visit backstage. But you had already picked the lock. The lions were hungry, and justice was served. Later, their {amount} coins transferred to your account. Nature is beautiful."
  },
  {
    emoji: "🏛️",
    text: "In the ancient temple, you challenged {target} to a ritual duel. They accepted, thinking it was ceremonial. But your blade was very real, and so was their blood on the altar. The priests declared you victor, and the spoils - {amount} coins - belonged to you by sacred law."
  },
  {
    emoji: "🌋",
    text: "The volcano expedition was your idea. {target} trusted your expertise in geology. At the crater's edge, one well-timed push and they were gone - consumed by the lava below. You descended alone and reported the tragic accident. Their insurance payout: {amount} coins."
  },
  {
    emoji: "🎪",
    text: "The knife-throwing act was flawless - usually. But tonight, your hand 'slipped' just as {target} stood against the board. The audience screamed, thinking it was part of the show. You bowed solemnly and left with their {amount} coins. Accidents happen in show business."
  },
  {
    emoji: "🗡️",
    text: "The medieval festival was the perfect setting. Your 'theatrical' sword was very real. During the mock battle, {target} realized too late that you weren't acting. The crowd thought the blood was corn syrup. You collected {amount} coins and left before anyone caught on."
  },
  {
    emoji: "🎯",
    text: "The hunting trip took a dark turn. {target} was tracking a deer when you lined up your shot. One bullet, mistaken identity - easily explained to authorities. You comforted their family while secretly accessing their accounts: {amount} coins. Such a tragic accident."
  },
  {
    emoji: "🚢",
    text: "The cruise ship had thousands of passengers - perfect cover. You cornered {target} on the deserted top deck at midnight. One push over the railing, and the ocean swallowed them whole. You returned to the party and spent their {amount} coins at the casino. Man overboard."
  },
  {
    emoji: "🎪",
    text: "As a professional stunt coordinator, you know exactly how to make deaths look accidental. {target} was your latest 'actor' in a very real performance. The explosion was perfectly timed. The crew thought it was all effects, and you walked away with {amount} coins."
  },
  {
    emoji: "⚡",
    text: "The storm provided excellent cover. You waited until {target} stepped into the puddle near the downed power line. One connection, and electricity did the rest. The city mourned the tragic accident while you deposited {amount} coins into offshore accounts. Perfect timing."
  },
  {
    emoji: "🏹",
    text: "Your archery skills are legendary. {target} thought they were safe at the tournament, surrounded by people. But in the chaos of the competition, one arrow went 'astray' - straight through their heart. You expressed horror with everyone else and collected {amount} coins later."
  },
  {
    emoji: "🎭",
    text: "The opera house has excellent acoustics - and excellent hiding spots. You waited in the rafters as {target} took their seat in the private box. During the crescendo, you struck. The music covered any sound. You slipped away and accessed their {amount} coins. Art imitates death."
  },
  {
    emoji: "🌪️",
    text: "The tornado shelter seemed safe - until you locked {target} outside. Their screams were drowned by the wind as the storm approached. You emerged hours later, the sole survivor. Authorities praised your luck. You praised the {amount} coins in their will."
  },
  {
    emoji: "🎪",
    text: "The escape artist act was supposed to be impossible to fail. But you modified the water tank before {target} entered it. They thrashed and struggled as you watched from backstage. The audience thought it was all part of the show until it was too late. {amount} coins for your trouble."
  },
  {
    emoji: "🗡️",
    text: "In the underground fighting ring, there are no rules. {target} stepped into the cage confident. You fought dirty, used every trick you knew. When they hit the ground, they didn't get back up. The crowd went wild. You claimed your prize: {amount} coins and a new reputation."
  },
  {
    emoji: "🎯",
    text: "The drone you modified flew silently through {target}'s window at 3 AM. The small payload was highly effective. By the time authorities arrived, you were miles away. Their accounts were already emptied - {amount} coins transferred through cryptocurrency. Technology is wonderful."
  },
  {
    emoji: "🏔️",
    text: "The avalanche wasn't natural - you triggered it remotely. {target} never heard it coming as tons of snow buried them. You waited hours before calling for help, ensuring no rescue was possible. Their expedition insurance paid out handsomely: {amount} coins."
  },
  {
    emoji: "🎪",
    text: "The psychic reading was very real, but not in the way {target} expected. You predicted their death - because you planned it. The poisoned tea took effect during the séance. Everyone thought they had a heart attack. You collected {amount} coins and closed up shop."
  },
  {
    emoji: "⚔️",
    text: "The historical reenactment battle was incredibly realistic. Perhaps too realistic. {target} fell with a real sword wound, and everyone applauded the special effects. You helped carry them off the field - and straight to your van. Their {amount} coins funded your relocation."
  },
  {
    emoji: "🎯",
    text: "As their trusted bodyguard, you knew {target}'s every move and weakness. When the 'assassination attempt' occurred, you pretended to fight off the attacker. But there was no attacker - just you. Their {amount} coins were payment for your years of loyal service."
  },
  {
    emoji: "🌊",
    text: "The scuba diving accident investigation concluded equipment failure. But you knew better - you'd sabotaged {target}'s oxygen tank the night before. They ran out of air 100 feet down. You surfaced alone, distraught, and soon after claimed {amount} coins. Deep water keeps secrets."
  },
  {
    emoji: "🎪",
    text: "The hypnotist act was your most elaborate plan. You put {target} in a deep trance and gave them a suggestion. Days later, they carried out your command - resulting in their own demise. No connection to you whatsoever. Their {amount} coins transferred as planned."
  },
  {
    emoji: "🗡️",
    text: "The samurai sword was authentic - sharp enough to cut through bone. {target} admired your collection, asking to hold it. You agreed, then demonstrated its effectiveness. One clean strike. You cleaned the blade, arranged the scene, and left with {amount} coins. Honor preserved."
  },
  {
    emoji: "🎯",
    text: "The smart home system you installed for {target} had special features they didn't know about. One command, and all the doors locked, gas started flowing, and security footage erased itself. Clean, remote, untraceable. Their {amount} coins downloaded to your encrypted drive."
  }
];

const FAILURE_SCENARIOS = [
  {
    emoji: "🛡️",
    text: "You burst through the door, weapon drawn, but {target} was already waiting. They anticipated your move and set up a trap. Your weapon clattered to the floor as they disarmed you. 'Nice try,' they smirked, before knocking you unconscious. You woke up hours later, broke and humiliated - they took your entire {amount} coin fortune."
  },
  {
    emoji: "⚔️",
    text: "The duel began at dawn. You charged forward confidently, but {target} was faster. They sidestepped your attack and countered with devastating precision. Your sword flew from your hand as their blade found its mark. As you collapsed, you watched helplessly as they claimed your {amount} coins. Honor demands you accept defeat."
  },
  {
    emoji: "🪤",
    text: "You thought you had the upper hand, sneaking into {target}'s hideout. But the floorboards creaked. Suddenly, the lights flashed on - you were surrounded. {target} emerged from the shadows, slow clapping. 'You walked right into my trap.' Their crew relieved you of your {amount} coins before throwing you out."
  },
  {
    emoji: "🎯",
    text: "You lined up the perfect shot from across the street. Just as you squeezed the trigger, {target} moved. They spotted the laser sight and rolled behind cover. Before you could react, they returned fire. Your rifle fell from your hands as their bullets found you. Your {amount} coins were their trophy."
  },
  {
    emoji: "🔪",
    text: "You waited in the darkness of {target}'s home, blade ready. But they weren't alone - their guard dog sensed you first. The barking alerted {target}, who was ex-military. Within seconds, you were pinned to the ground. They called the police but kept your {amount} coins as compensation for their trouble."
  },
  {
    emoji: "💣",
    text: "The explosives were set, the timer counting down. But {target} found them with seconds to spare. A bomb disposal expert by trade, they easily defused your device. They tracked you down within hours. 'Amateur hour,' they laughed, taking every coin you had - {amount} coins gone in an instant."
  },
  {
    emoji: "☠️",
    text: "The poison was supposed to be undetectable, but {target} had built up an immunity over years. They smiled as they watched you realize your plan failed. 'I've been expecting something like this,' they said, pulling out a syringe. You woke up days later in a hospital, bankrupt - {amount} coins poorer."
  },
  {
    emoji: "🗡️",
    text: "Your blade struck true - or so you thought. {target} wore body armor under their coat. They didn't even flinch. 'My turn,' they said, drawing their own weapon. You tried to run but didn't make it far. They took your {amount} coins as payment for your foolishness and let you live as a warning."
  },
  {
    emoji: "⚡",
    text: "The electrical trap was ingenious, or so you believed. But {target} was an electrician who spotted your tampering immediately. They reversed the polarity. When you tried to trigger it remotely, the current traveled back through your device. You survived, but your {amount} coins didn't - they claimed them as compensation."
  },
  {
    emoji: "🎭",
    text: "You'd been playing the long con, gaining {target}'s trust for months. But they were playing you the entire time. When you finally made your move, they revealed they'd known all along. 'I'm better at this game than you,' they said, taking your {amount} coins. You never saw them again."
  },
  {
    emoji: "🔫",
    text: "You kicked down the door, gun raised. But your intelligence was wrong - {target} had backup. Three laser sights painted your chest red. You dropped your weapon. They took everything - your pride, your reputation, and your {amount} coins. 'Next time do better research,' they advised."
  },
  {
    emoji: "🌙",
    text: "Under the full moon, you tracked {target} through the forest. But they're a better hunter than you. They led you in circles before ambushing YOU. You never saw them coming. When you regained consciousness, you were tied to a tree, {amount} coins lighter. They left you alive out of pity."
  },
  {
    emoji: "🎲",
    text: "The rigged game seemed foolproof. But {target} had been counting cards and noticed your cheating. They let you think you were winning, then revealed their hand - and their backup. The casino security was on their payroll. They took your {amount} coins and banned you for life."
  },
  {
    emoji: "🏴‍☠️",
    text: "The pirate duel on deck was going well until {target} revealed they'd been holding back. With lightning speed, they disarmed you and pinned you against the mast. The crew laughed as they claimed your {amount} coins. 'Never challenge the captain,' they said, sparing your life but not your wallet."
  },
  {
    emoji: "🦅",
    text: "From your sniper nest, you had the perfect shot. But {target} had countersnipers you didn't know about. The moment you fired, they triangulated your position. Their return fire was precise. You barely escaped with your life, but not with your {amount} coins - they raided your hideout."
  },
  {
    emoji: "🌊",
    text: "You lured {target} to the docks for a confrontation. But the water was their element. A former Navy SEAL, they moved with deadly grace. You found yourself in the water, disoriented. They pulled you out and took your {amount} coins. 'Amateur move,' they said, disappearing into the night."
  },
  {
    emoji: "🕷️",
    text: "The rare spider venom cost you dearly, but you were confident. What you didn't know: {target} was already immune, having survived a bite years ago. They felt the prick, smiled, and waited. When you thought they were dying, they grabbed you. Your {amount} coins paid for their 'funeral expenses.'"
  },
  {
    emoji: "🎯",
    text: "The tournament seemed perfect for your plan. But {target} was the defending champion for a reason. They read your every move, countered every strike. The match ended in seconds. Humiliated in front of everyone, you also lost your {amount} coins - winner takes all, after all."
  },
  {
    emoji: "🗝️",
    text: "Breaking into {target}'s vault was easy. Too easy. The moment you cracked the safe, alarms you couldn't detect went off. {target} appeared behind you with security. 'I knew you'd try this eventually,' they said. They kept your {amount} coins and added a restraining order. You got off lucky."
  },
  {
    emoji: "🎨",
    text: "The art gallery opening was sophisticated cover. Your poisoned needle was ready. But {target} noticed your approach in a mirror reflection. They dodged, grabbed your wrist, and twisted. The needle meant for them ended up sedating you. You woke up in an alley, {amount} coins gone."
  },
  {
    emoji: "🏔️",
    text: "The mountain expedition was your perfect crime. But {target} was an experienced climber who noticed you weren't clipped in properly. When you tried to push them, they used their momentum to swing you over the edge instead. They pulled you back up - then took your {amount} coins for attempted murder."
  },
  {
    emoji: "⚗️",
    text: "Your chemical compound was supposed to be undetectable. But {target} was a toxicologist who recognized the symptoms immediately. They took the antidote and called for help. When authorities arrived, they found you with the evidence. {target} sued and won - your entire {amount} coin fortune."
  },
  {
    emoji: "🚁",
    text: "The helicopter ride at 5,000 feet seemed perfect. But {target} was wearing a hidden parachute - they'd suspected your intentions. When you opened the door, they grabbed YOU and jumped, pulling you with them. You survived the landing, but they took your {amount} coins before disappearing."
  },
  {
    emoji: "🔬",
    text: "The lab 'accident' was meticulously planned. But {target} had installed hidden cameras you didn't know about. They caught you tampering with the equipment on video. The footage went straight to police. You avoided prison but lost your {amount} coins in the settlement. Science doesn't lie."
  },
  {
    emoji: "🏛️",
    text: "In the ancient temple, you challenged {target} to ritual combat. But they were a martial arts master who'd trained in these very halls. The duel lasted three moves - all theirs. The priests declared them victor and awarded them your {amount} coins. Sacred law is absolute."
  },
  {
    emoji: "🌋",
    text: "The volcano expedition was your idea, your plan. But {target} knew geology better. When you tried to push them at the crater's edge, they predicted it and sidestepped. Your momentum carried you forward. They grabbed your belt, pulled you back, and took your {amount} coins. 'For saving your life.'"
  },
  {
    emoji: "🎪",
    text: "The knife-throwing act was supposed to 'accidentally' kill {target}. But they caught your knife mid-air - an acrobat with inhuman reflexes. They threw it back, pinning your sleeve to the board. The crowd went wild at the 'performance.' Backstage, they claimed your {amount} coins as payment."
  },
  {
    emoji: "🗡️",
    text: "The medieval festival combat was supposed to be your cover. But {target} was a real historical weapons expert. They identified your real blade instantly and called you out. The authorities arrested you, and {target} sued for endangerment. Your {amount} coins barely covered their legal fees."
  },
  {
    emoji: "🚢",
    text: "The cruise ship seemed perfect for a disappearance. But {target} was a retired cop with sharp instincts. They caught your reflection in a window before you could push. They spun around and threw YOU overboard instead. You were rescued hours later, but your {amount} coins were gone."
  },
  {
    emoji: "⚡",
    text: "The storm and downed power line were perfect conditions. But {target} saw you tampering with the wires earlier. They avoided the puddle and confronted you instead. One well-placed push, and YOU touched the wire. You survived, but spent weeks in hospital. They kept your {amount} coins for medical bills."
  },
  {
    emoji: "🏹",
    text: "Your archery skills are good, but {target}'s are legendary. At the tournament, they saw your 'accidental' aim and fired first. Your arrow missed. Theirs didn't. You survived with minor injuries but major humiliation. They claimed your {amount} coins as the tournament prize. Better luck next time."
  },
  {
    emoji: "🎭",
    text: "The opera house seemed perfect for an ambush from the rafters. But {target} had bodyguards you didn't see. The moment you moved, they moved faster. You were captured before you could strike. {target} watched as security emptied your accounts - {amount} coins transferred as 'security fees.'"
  },
  {
    emoji: "🌪️",
    text: "The tornado shelter seemed like the perfect death trap. But {target} was a storm chaser who'd survived worse. They broke through your lock in seconds and pulled YOU outside instead. When the storm passed, they kept your {amount} coins. 'Payment for the locksmith,' they said."
  },
  {
    emoji: "🎪",
    text: "The escape artist tank was modified to be inescapable. But {target} was trained by Houdini's apprentice. They escaped in under 30 seconds and surfaced behind you. 'Nice try,' they said, before security arrived. They kept your {amount} coins and pressed charges. You should've done better research."
  },
  {
    emoji: "🗡️",
    text: "The underground fighting ring has no rules - which means {target} didn't have to fight fair either. They brought brass knuckles, friends, and a bad attitude. You lasted one round. They took your {amount} coins and your dignity. The crowd booed as you were dragged out."
  },
  {
    emoji: "🎯",
    text: "The modified drone flew perfectly - straight into {target}'s anti-drone defense system. They'd suspected something and were ready. Your drone was traced back to you within minutes. Police arrived before you could run. {target} sued for attempted murder and won your entire {amount} coin fortune."
  },
  {
    emoji: "🏔️",
    text: "You triggered the avalanche remotely, watching from safety. But {target} was an avalanche survivor with emergency training. They deployed their airbag backpack and rode the snow to safety. Worse, they recorded you on their helmet cam. Your {amount} coins went to their legal team."
  },
  {
    emoji: "⚔️",
    text: "The historical reenactment seemed like perfect cover for murder. But {target} was a championship fencer who noticed your real sword immediately. They disarmed you in front of everyone and revealed your plot. You were arrested, sued, and lost your {amount} coins. Your acting career is over."
  },
  {
    emoji: "🎯",
    text: "As their bodyguard, you knew {target}'s routine perfectly. But they knew you better - and suspected your betrayal. When you staged the 'attack,' they revealed they'd been wearing a wire. Everything was recorded. You lost your job, your freedom (briefly), and your {amount} coins in the settlement."
  },
  {
    emoji: "🌊",
    text: "The scuba diving 'accident' seemed foolproof. But {target} was a Navy diver who noticed their tank pressure was wrong before diving. They checked and found your sabotage. Underwater, they grabbed YOUR regulator and took it. You barely made it up. They kept your {amount} coins 'for the inconvenience.'"
  },
  {
    emoji: "🎪",
    text: "The hypnotist act was brilliant - except {target} was hypnotherapy trained and resisted. They played along, pretending to be under. When you gave the fatal suggestion, they reported you instead. The police found evidence of your other 'acts.' Your {amount} coins covered their therapy bills."
  },
  {
    emoji: "🗡️",
    text: "The authentic samurai sword was deadly sharp. You demonstrated on a practice dummy, then offered it to {target}. But they were faster - they took it and turned it on you instead. One clean strike at your wallet. They took your {amount} coins and left. 'Study the blade,' they said mockingly."
  },
  {
    emoji: "🎯",
    text: "The smart home system you installed had backdoors for your plan. But {target} was a cybersecurity expert who found them immediately. They reverse-engineered your code and used it against you. Your own home locked you in as police arrived. Your {amount} coins paid for their security upgrades."
  },
  {
    emoji: "💀",
    text: "You prepared everything perfectly, studying {target} for weeks. But what you didn't know: they were studying you too. They knew about your plan before you even started. When you made your move, they'd already moved. The trap was yours. You lost {amount} coins and learned a valuable lesson: some prey hunt back."
  },
  {
    emoji: "🔥",
    text: "The fire was meant to look accidental, consuming all evidence. But {target} was a firefighter who recognized accelerant patterns instantly. They escaped and saved evidence of your arson. The investigation led straight to you. Your {amount} coins barely covered the property damage lawsuit."
  },
  {
    emoji: "🎰",
    text: "You thought you were the mastermind, the one in control. But {target} let you think that. Every step you took was anticipated, every move countered. When you finally realized you'd been played, it was too late. They had your {amount} coins and disappeared. You never even saw their real face."
  },
  {
    emoji: "🌙",
    text: "The midnight ambush was perfectly timed. You struck from the shadows - but hit a dummy. {target} had known you were coming and set a decoy. They were behind you the whole time. One hit, and you were down. You woke up at dawn, alone and {amount} coins poorer. They left a note: 'Better luck next time.'"
  },
  {
    emoji: "🎪",
    text: "The circus strongman act gave you the perfect alibi. You'd crush {target} during the performance, make it look like an accident. But they were stronger than they looked - much stronger. They reversed your hold and lifted YOU over their head. The crowd loved it. Your {amount} coins became their performance bonus."
  },
  {
    emoji: "⚡",
    text: "The taser was military grade, guaranteed to incapacitate. You got close, aimed, and fired. Nothing happened - {target} wore a hidden voltage-resistant vest. They grabbed the taser, used it on you. While you twitched on the ground, they took your {amount} coins. 'Thanks for the donation,' they said."
  },
  {
    emoji: "🗡️",
    text: "The ambush in the parking garage was textbook perfect. But {target} had served two tours in combat zones - they sensed you before you moved. Their military training kicked in. Within seconds, you were disarmed and on the ground. They took your {amount} coins and called it 'PTSD therapy funding.'"
  }
];

/**
 * Get a random success scenario
 */
function getSuccessScenario() {
  return SUCCESS_SCENARIOS[Math.floor(Math.random() * SUCCESS_SCENARIOS.length)];
}

/**
 * Get a random failure scenario
 */
function getFailureScenario() {
  return FAILURE_SCENARIOS[Math.floor(Math.random() * FAILURE_SCENARIOS.length)];
}

/**
 * Format a scenario with actual usernames and amounts
 */
function formatScenario(scenario, targetUsername, amount) {
  let text = scenario.text
    .replace(/{target}/g, targetUsername)
    .replace(/{amount}/g, amount.toLocaleString());

  return {
    emoji: scenario.emoji,
    text: text
  };
}

module.exports = {
  SUCCESS_SCENARIOS,
  FAILURE_SCENARIOS,
  getSuccessScenario,
  getFailureScenario,
  formatScenario
};