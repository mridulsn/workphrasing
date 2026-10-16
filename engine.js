/* workphrasing phrasebook engine.
   Reads how a heated work message feels, then writes a calm message you can send in chat
   (or an email, if you need one). Runs entirely in the browser (also loadable in Node for tests).
   It never copies the user's words into the message, so insults and swearing can't leak through. */
(function (root) {
  'use strict';

  var LEVELS = ['Warm', 'Straight', 'Firm'];
  var KEYS = ['warm', 'straight', 'firm'];
  var RECIPIENTS = ['teammate', 'manager', 'client', 'group'];

  /* ---------- Feelings ---------- */

  var FEELINGS = {
    frustrated: { label: 'frustrated' },
    angry: { label: 'angry' },
    overwhelmed: { label: 'overwhelmed' },
    anxious: { label: 'worried' },
    hurt: { label: 'hurt' },
    disappointed: { label: 'disappointed' },
    impatient: { label: 'impatient' },
    confused: { label: 'confused' },
    neutral: { label: 'calm' }
  };
  var FEELING_ORDER = ['angry', 'hurt', 'overwhelmed', 'anxious', 'confused', 'disappointed', 'frustrated', 'impatient'];

  var SWEAR = /\b(f+u+c+k\w*|shit\w*|damn\w*|wtf|ffs|crap\w*|bloody|bullshit|pissed|bastards?|arse|ass(hole)?s?)\b/;
  var INSULT = /\b(stupid|idiots?|dumb|useless|incompetent|clueless|morons?|brainless|pathetic|lazy|a joke)\b/;

  // Each cue: a pattern, and the feeling it points to. Category matches add weight too (see CATS).
  var CUES = [
    ['angry', /\b(angry|furious|livid|pissed( off)?|raging|rage|mad at)\b/],
    ['angry', /\b(unacceptable|how dare|outrageous|disgraceful)\b/],
    ['angry', /\bare (you|they) (blind|stupid|serious|kidding|joking|deaf)\b/],
    ['angry', SWEAR],
    ['angry', INSULT, 2],
    ['frustrated', /\b(fed up|sick (of|and tired)|had enough|frustrat\w*|annoy\w*|irritat\w*|ugh+|argh+)\b/],
    ['frustrated', /\b(again|keeps?|still|every (single )?time|seriously|ridiculous)\b/],
    ['frustrated', /\bhow many times\b/],
    ['overwhelmed', /\b(overwhelm\w*|swamped|drowning|buried|too much|so much (work|to do)|overload\w*|burn(ed|t)? ?out|exhausted|stretched|can'?t (keep up|cope|manage)|no time|on my plate|too many (tasks|things|projects))\b/],
    ['anxious', /\b(worried|worry|nervous|scared|afraid|anxious|anxiety|stress(ed|ful)?|panic\w*|what if|get (fired|in trouble)|not sure (if|whether|how))\b/],
    ['hurt', /\b(hurt|disrespect\w*|humiliat\w*|embarrass\w*|unappreciated|not valued|undervalued|invisible|talked down|talks down|condescend\w*|patroni[sz]\w*|rude to me|behind my back|left out|excluded)\b/],
    ['hurt', /\bin front of (everyone|the (whole )?(team|client|others|group|room)|people|others)\b/],
    ['disappointed', /\b(disappoint\w*|let (me|us|the team) down|expected (better|more)|not what (we|i) (agreed|asked)|thought we agreed|sloppy|not good enough|poor (work|quality|job))\b/],
    ['impatient', /\b(still waiting|waiting (for|on)|where is|when will|hurry|asap|how long|any update|overdue|late|eta)\b/],
    ['confused', /\b(confus\w*|don'?t (understand|get it)|no idea what|unclear|makes no sense|what do (you|they) mean|lost|which one)\b/],
    ['confused', /\?\?+/]
  ];

  var BOOSTERS = /\b(so|really|literally|absolutely|completely|totally|seriously|extremely)\b/g;
  var ABSOLUTE = /\b(always|never|nobody|no one|everyone|every (single )?time|nothing ever)\b/;
  var FAUX = /\b(ignored|disrespected|unappreciated|undervalued|betrayed|manipulated|invisible|attacked|unheard)\b/;
  var FAUX_NEED = {
    ignored: ['hurt', 'to be kept in the loop'], disrespected: ['hurt', 'respect'],
    unappreciated: ['hurt', 'your work to be seen'], undervalued: ['hurt', 'your work to be seen'],
    betrayed: ['hurt', 'trust'], manipulated: ['uneasy', 'honesty'],
    invisible: ['left out', 'to be included'], attacked: ['upset', 'respect'], unheard: ['frustrated', 'to be listened to']
  };

  /* ---------- Situations ---------- */
  // Each category: patterns, the feeling it usually carries, why it matters (shown, never sent),
  // email subjects, and chat lines as [say, ask] pairs per level, plus a passive-aggressive set.
  // {thing} = a work noun found in the message (or the fallback). {count}/{countth} = "three"/"fourth".
  // {topic} = what the message is about, picked from a fixed list (see TOPICS), never the user's own words.
  var CATS = [
    { id: 'refused', feel: 'disappointed', why: 'a request of yours was turned down', tf: 'my request',
      topics: ['my leave request', 'my cancelled work from home day', 'a pay rise', 'my monitor request'],
      re: [/\b(reject\w*|denied|declined|refused|turned down|said no)\b/],
      subject: ['About {topic}', 'Revisiting {topic}', 'Request to reconsider: {topic}'],
      warm: [["I was really disappointed that {topic} was turned down.", "Could we talk about whether there's a way to make it work?"],
             ["{Topic} means a lot to me, so the answer was hard to hear.", "Could we look at it again together?"]],
      straight: [["I'd like to understand why {topic} was turned down.", "Could we discuss options that would make it work?"],
                 ["{Topic} matters to me, and I'd like to revisit it.", "What would need to change for it to be approved?"]],
      firm: [["I'm asking for {topic} to be reconsidered.", "Please share the reason for the decision in writing."],
             ["I don't agree with the decision on {topic}.", "Please review it again this week."]],
      pa: [["I see {topic} didn't quite make the cut.", "Happy to hear the reasoning :)"],
           ["Bold choice on {topic}.", "Could we talk about it? :)"]] },

    { id: 'recognition', feel: 'hurt', why: "your extra effort went unnoticed", tf: 'the extra hours I put in',
      topics: [],
      re: [/\b(nobody|no one|no-one|never|not even)\b.*\b(thank\w*|thanks|appreciat\w*|noticed|acknowledg\w*)\b/, /\bwithout (a |any )?(thanks|thank you)\b/,
           /\b(worked|stayed|working) (till|until|late)\b/],
      subject: ['About the extra hours', 'Recognising the extra effort', 'Acknowledgement of extra hours'],
      warm: [["I put in some long hours on this, and a quick word would have meant a lot.", "Could we touch base on how it went?"],
             ["I went the extra mile on this one and I'm proud of it.", "Could we talk about how it landed?"]],
      straight: [["I put in {topic} to get this done.", "Could we make sure that kind of effort gets acknowledged?"],
                 ["The late nights on this went unmentioned.", "Could we talk about how extra effort is recognised?"]],
      firm: [["I worked well beyond my hours on this, and it went unacknowledged.", "Please make sure that effort is recognised."],
             ["{Topic} shouldn't go unnoticed.", "I'd like it on record in my next review."]],
      pa: [["Happy to report the work got done, at 2am, quietly.", "No thanks needed, apparently :)"],
           ["The late nights were their own reward, I suppose.", "A quick thanks would be a nice bonus :)"]] },

    { id: 'breaks', feel: 'frustrated', why: 'your breaks keep getting taken over', tf: 'my lunch break', topics: ['my lunch break'], not: /\b(fridge|my food|eat(s|ing)? my)\b/,
      re: [/\blunch\b/, /\bwhen i (sit down to )?eat\b/, /\b(my|a|the) break\b/, /\bno time to eat\b/],
      subject: ['About {topic}', 'Keeping {topic} free', 'Protecting {topic}'],
      warm: [["I'd love to keep {topic} free where I can.", "Could we try to schedule things outside it?"],
             ["I've noticed things keep landing on {topic}.", "Would it be OK to move them a little earlier or later?"]],
      straight: [["Things keep getting booked over {topic}.", "Could we keep that hour free from now on?"],
                 ["I need {topic} to recharge and stay sharp.", "Could we schedule calls outside that hour?"]],
      firm: [["I'll be keeping {topic} free from now on.", "Please book anything else outside that hour."],
             ["{Topic} isn't available for calls or work.", "Please schedule around it going forward."]],
      pa: [["Funny how everything urgent happens right over {topic}.", "Maybe after I've eaten? :)"],
           ["I'll be unreachable over {topic}, shocking as that may be.", "Back right after :)"]] },

    { id: 'pay', feel: 'disappointed', why: "your pay doesn't match the work you're doing", tf: 'my pay', topics: ['my salary hike', 'a pay rise', 'my salary', 'my bonus'],
      not: /\b(won'?t|not|refus\w*) (to )?pay\b|\bpay for\b/,
      re: [/\b(salary|hike|increment|raise|pay rise|pay|bonus|compensation|ctc)\b/, /\b\d+ ?(%|percent)\b/, /\bearns? more\b/],
      subject: ['Discussing {topic}', 'Request to review {topic}', 'Formal request: review of {topic}'],
      warm: [["I'd like to talk about {topic} and how it reflects the work I've been doing.", "Could we find some time this week?"],
             ["I've been thinking about {topic}, and I'd value a proper conversation.", "Could we set up a short meeting?"]],
      straight: [["I'd like to discuss {topic}, as it doesn't reflect the scope I've been covering.", "Could we set up a time this week?"],
                 ["I'd like to discuss {topic} with you properly.", "Could we review it together, with what I've delivered this year?"]],
      firm: [["I'm asking for a formal review of {topic}.", "Please let me know the process and a date for it."],
             ["{Topic} doesn't match the work I'm doing.", "Please set up a review of it this month."]],
      pa: [["Just doing some quick maths on {topic} versus my workload.", "Could we compare notes? :)"],
           ["I'm sure {topic} was a typo.", "Happy to look at it together :)"]] },

    { id: 'promotion', feel: 'disappointed', why: "a promise about your role hasn't been kept", tf: 'my promotion', topics: ['my promotion', 'my role and title'],
      re: [/\bpromot(ion|ed|e)\b/, /\b(title|designation)\b/, /\bpromised\b/, /\b(team lead|manager'?s) (role|job)\b/],
      subject: ['Following up on {topic}', 'Next steps on {topic}', 'Formal follow-up: {topic}'],
      warm: [["I wanted to check in on {topic}, as it's really important to me.", "Could we talk about a clear timeline?"],
             ["{Topic} has been on my mind since we last spoke.", "Could we look at where things stand?"]],
      straight: [["We discussed {topic} before, and it hasn't happened yet.", "Could we agree a clear date and what's needed?"],
                 ["I'd like to follow up on {topic}.", "What exactly needs to happen, and by when?"]],
      firm: [["{Topic} was promised and hasn't happened.", "Please confirm a date and the criteria in writing."],
             ["I need a clear answer on {topic}.", "Please share a firm timeline this week."]],
      pa: [["Just checking whether {topic} is still on this year's calendar.", "Or next year's :)"],
           ["Gently circling back on {topic}, which I believe was promised.", "Any update? :)"]] },

    { id: 'talkedover', feel: 'hurt', why: 'you keep getting talked over', tf: 'being interrupted when I speak',
      re: [/\btalks? over\b/, /\btalking over\b/, /\bcut(s|ting)? me off\b/, /\binterrupt\w*\b/, /\bdon'?t let me (finish|speak)\b/],
      subject: ['About our meetings', 'A request for meetings', 'Meeting conduct'],
      warm: [["In meetings I sometimes don't get to finish my point.", "Could we make sure everyone gets to finish?"],
             ["I'd love a bit more room to share my view in meetings.", "Could you help me get a word in?"]],
      straight: [["I've noticed I often get cut off when I speak in meetings.", "Could I finish my point before we move on?"],
                 ["I'd like to be able to finish my points in meetings.", "Could we keep an eye on that from now on?"]],
      firm: [["I need to be able to finish my point in meetings.", "Please let me finish before responding."],
             ["Being cut off mid-point isn't working for me.", "Please let me finish when I'm speaking."]],
      pa: [["I had a great point earlier, I'll share it in writing.", "Maybe I'll get to the end of it this time :)"],
           ["I'll put my thoughts in the chat, since the meeting moved fast.", "Easier to finish a sentence there :)"]] },

    { id: 'covering', feel: 'frustrated', why: "you're covering for someone else", tf: 'covering for others', topics: ['covering for others'],
      re: [/\bcover(ing)? for\b/, /\bcover(ing)? (the |his |her |their )?(night |day |morning |weekend )?(shift|work|duties)\b/, /\bdoing (his|her|their) (job|work)\b/],
      subject: ['About covering for others', 'Covering arrangements', 'Covering: needs a fix'],
      warm: [["I've been happy to help by covering, but it's become a regular thing.", "Could we find a fairer setup?"],
             ["Covering for others is starting to eat into my own work.", "Could we talk about how to share it?"]],
      straight: [["I've been covering for others regularly, and it's affecting my own work.", "Could we agree a proper plan for cover?"],
                 ["Covering has become a routine part of my week.", "Can we fix the underlying issue?"]],
      firm: [["I can't keep covering on a regular basis.", "Please put a proper cover plan in place this week."],
             ["Regular cover isn't part of my role.", "Please arrange a fair rota."]],
      pa: [["Happy to keep covering, I'm practically two people now.", "Maybe two salaries too? :)"],
           ["I seem to have picked up a second job without noticing.", "Could we chat about that? :)"]] },

    { id: 'incident', feel: 'angry', why: 'something broke and you were left to clean it up', tf: 'the broken release', topics: ['the production issue', 'the broken build', 'the broken release'],
      re: [/\b(prod|production|build|release|deploy\w*|server|site|app|code|branch)\b.*\b(broke|broken|crash\w*|down|fail\w*)\b|\b(broke|broken|crash\w*)\b.*\b(prod|production|build|release|deploy\w*|server|site|app)\b/,
           /\b(outage|incident|hotfix|rollback|rolled back)\b/, /\bwithout (tests|testing|review)\b/, /\b(pushed|merged)\b/],
      subject: ['About {topic}', 'Avoiding a repeat of {topic}', 'Incident follow-up: {topic}'],
      warm: [["{Topic} is sorted now, but it was a rough one.", "Could we agree a quick check before anything ships?"],
             ["I've fixed {topic}, and I'd love to stop it happening again.", "Could we look at the release steps together?"]],
      straight: [["I had to fix {topic} outside working hours.", "Could we agree that changes are tested and someone's around after a release?"],
                 ["{Topic} cost me my weekend.", "Can we add a review step before anything goes live?"]],
      firm: [["{Topic} should not have gone out untested.", "Please make sure changes are reviewed and supported after release."],
             ["I won't be the default fixer for {topic}.", "Please stay available after you release anything."]],
      pa: [["Spent a lovely weekend with {topic}.", "Maybe a quick test next time? :)"],
           ["{Topic} and I are now very close friends.", "A review before release would be lovely :)"]] },

    { id: 'leave', feel: 'frustrated', why: 'your time off is being held up', tf: 'my leave request', topics: ['my leave request', 'comp off for the weekend we worked'],
      re: [/\bleave( request| application)?\b(?! me\b)/, /\bcomp[ -]?off\b/, /\bno comp[ -]?off\b/, /\bday off\b/, /\btime off\b/],
      subject: ['About {topic}', 'Update needed: {topic}', 'Pending: {topic}'],
      warm: [["I wanted to check on {topic}, as it means a lot to me.", "Could you let me know where it stands?"],
             ["Just a gentle nudge on {topic}.", "Any news on it?"]],
      straight: [["I'm waiting to hear back on {topic}.", "Could I get an answer this week?"],
                 ["{Topic} still needs an answer.", "Could you confirm it by Friday so I can plan?"]],
      firm: [["{Topic} still hasn't been answered.", "Please confirm it in writing by end of this week."],
             ["I need a decision on {topic}.", "Please approve it, or tell me the reason, by Friday."]],
      pa: [["Checking whether {topic} is still on its way.", "No rush, it's only my life :)"],
           ["Just wondering if {topic} got lost somewhere.", "Any sighting? :)"]] },

    { id: 'privacy', feel: 'hurt', why: 'something private of yours was shared', tf: 'my private details', topics: ['my medical details', 'my salary details'],
      re: [/\b(shar\w*|forward\w*|told|show\w*|leak\w*)\b.*\b(my )?(salary|pay|medical|certificate|health|personal|private|details)\b/,
           /\bconfidential\b/, /\b(with|to) the (whole |entire )?(team|department|group|office)\b/],
      subject: ['About {topic}', 'Keeping {topic} private', 'Confidentiality concern'],
      warm: [["I was a bit thrown to see {topic} shared more widely.", "Could we keep things like that private in future?"],
             ["I'd like to keep {topic} between us.", "Could you check with me before sharing anything personal?"]],
      straight: [["{Topic} got shared more widely than I'd expect.", "Could we keep personal details confidential from now on?"],
                 ["I wasn't comfortable with {topic} being shared.", "Please check with me before sharing anything personal."]],
      firm: [["{Topic} should not have been shared.", "Please keep my personal information confidential."],
             ["Sharing {topic} wasn't appropriate.", "Please confirm it won't happen again."]],
      pa: [["Fascinating to see {topic} doing the rounds.", "Maybe keep the next update just between us? :)"],
           ["I see {topic} became common knowledge.", "Happy to keep the rest a surprise :)"]] },

    { id: 'vendor', feel: 'impatient', why: "you're stuck waiting on a supplier", tf: 'the delivery', topics: ['the mix-up with the parts', 'the delivery', 'a response from support'], not: /\bout of order\b/,
      re: [/\b(vendor|supplier|courier|shipment|shipped|parts|order(ed)?)\b/, /\bwrong (parts|items|order)\b/],
      subject: ['Following up on {topic}', 'Update needed: {topic}', 'Escalation: {topic}'],
      warm: [["Just checking in on {topic}.", "Could you share an update when you can?"],
             ["We're keen to get {topic} sorted.", "Any news on a fix or a date?"]],
      straight: [["{Topic} is holding up our work.", "Could you confirm a date for it today?"],
                 ["We still need {topic} sorted as agreed.", "When can we expect that?"]],
      firm: [["{Topic} is now seriously affecting our operations.", "Please confirm a firm date today, or we'll need to escalate."],
             ["{Topic} still isn't resolved.", "Please confirm the fix and the date by end of day."]],
      pa: [["Just checking that {topic} hasn't taken the scenic route.", "Any update? :)"],
           ["We're still eagerly awaiting news on {topic}.", "Any day now :)"]] },

    { id: 'afterhours', feel: 'frustrated', why: 'work keeps spilling past your working hours', tf: 'messages after hours', topics: ['calls after hours', 'messages after hours', 'weekend work'],
      re: [/\b(midnight|late at night|at night)\b/, /\b(9|10|11|12)\s?pm\b/, /\b(1|2|3|4|5)\s?am\b/,
           /\b(weekends?|saturday|sunday|holiday|diwali)\b/, /\bwhatsapp\b/, /\bafter (hours|work|office)\b/],
      subject: ['About {topic}', 'Working hours', 'My working hours'],
      warm: [["I'm trying to switch off properly outside work hours.", "Could we keep {topic} for real emergencies?"],
             ["I want to be fresh for work, so I'm protecting my time off.", "Could we keep my time off free unless it's urgent?"]],
      straight: [["I'm not available for work outside my working hours.", "Could we keep {topic} for genuine emergencies?"],
                 ["Work outside my hours makes it hard to rest and do good work.", "Can it wait until the next working day unless it's urgent?"]],
      firm: [["I don't take work outside my working hours.", "Please hold anything non-urgent until the next working day."],
             ["Work outside my hours needs to stop unless it's a real emergency.", "Please send it during working hours."]],
      pa: [["I'm sure {topic} felt very urgent at the time.", "I'll see it first thing in the morning :)"],
           ["My phone and I keep office hours now.", "See it in the morning :)"]] },

    { id: 'repeat', feel: 'frustrated', why: "you've had to repeat yourself",
      re: [/\balready (told|said|sent|explained|mentioned|asked|shared)\b/, /\bhow many times\b/,
           /\b(\d+|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|hundred|hundreds|thousand|thousands|million|millions|zillion|many|countless|umpteen) times\b/,
           /\btwice\b/, /\bagain and again\b/, /\brepeat(ing|ed)?( myself)?\b/, /\b(told|said|explained|mentioned) (you|this|it|that) (before|already)\b/, /\bagain\b/],
      subject: ['Quick recap', 'Summary for reference', 'Final reiteration (please keep for reference)'],
      warm: [["Sharing this again in one place, in case it got buried.", "Happy to jump on a quick call if that's easier."],
             ["Here's the short version again, in case my earlier message wasn't clear.", "Could we pin it somewhere easy to find?"]],
      straight: [["This has come up a few times, so here it is again in one place.", "Could we save it somewhere the whole team can find it?"],
                 ["Resending the details from earlier.", "Could we pin this one so it's easy to find next time?"]],
      firm: [["This is the same information I've already shared.", "Please refer back to this message from now on."],
             ["Restating this one final time so there's a single reference.", "Please pin it and check it before asking again."]],
      pa: [["As per my last message (and the one before that), here it is again.", "Might be worth pinning this one :)"],
           ["Just reiterating what I've already shared. Nothing has changed.", "Maybe bookmark it this time? :)"]],
      count: { warm: ["We've been over this {count} times, so here it is again in one place."],
               straight: ["This is the {countth} time this has come up, so here it is in one place."],
               firm: ["This is the {countth} time I'm sharing this."],
               pa: ["As mentioned in my {count} previous messages, here it is again.", "Sharing this for the {countth} time, just in case."] } },

    { id: 'notread', feel: 'frustrated', why: "it feels like they didn't read what you sent", fallback: 'message',
      re: [/\bread\b/, /\bblind\b/, /\bcan'?t you see\b/, /\bdid (you|they) (even )?(check|look|open)\b/,
           /\bit'?s (right )?(there|in the)\b/, /\bscroll\b/, /\battach(ed|ment)\b/],
      subject: ['The details you asked for', 'Re: As per the attached', 'Information previously provided'],
      warm: [["It's all in the {thing} I shared earlier, and I'm happy to point to the exact bit.", "Shout if anything there doesn't make sense."],
             ["The answer should be in my earlier {thing}.", "Want me to walk you through it quickly?"]],
      straight: [["This is covered in the {thing} I shared earlier.", "Have a look at the first part, and shout if questions remain."],
                 ["The {thing} from earlier answers this.", "Could you take a look and tell me if anything's still unclear?"]],
      firm: [["This is covered in full in the {thing} I already shared.", "Please read it first and come back with specific questions."],
             ["The {thing} I sent earlier answers this.", "Please review it before we discuss further."]],
      pa: [["As mentioned in the {thing} I shared, this is all covered there.", "Scrolling up should help :)"],
           ["Gently pointing back to the {thing} from earlier.", "It's a good read, honestly :)"]] },

    { id: 'blame', feel: 'angry', why: "you're being blamed for something",
      re: [/\b(your|ur|their|his|her) fault\b/, /\bnot my fault\b/, /\bblam(e|ed|es|ing)\b/, /\bbecause of (you|them|him|her)\b/,
           /\b(you|they|he|she) (messed|screwed|broke|ruined|mess(ed)? up)\b/, /\bunder the bus\b/],
      subject: ['Working out what happened', 'Clarifying ownership', 'Record of events'],
      warm: [["Looks like there's been a mix-up on this one.", "Could we work out together what happened, so it doesn't repeat?"],
             ["I think something got crossed somewhere.", "Can we look at the steps together and fix it?"]],
      straight: [["This step wasn't on my side, and the thread shows where it sat.", "Could we agree who owns each step from here?"],
                 ["I want to fix this, and I also want to be clear it wasn't my call.", "Can we go through the timeline together today?"]],
      firm: [["I can't take responsibility for a decision I wasn't part of.", "Please confirm ownership of each step in writing going forward."],
             ["For accuracy, this was not my decision.", "Let's agree in writing who owns what from here."]],
      pa: [["Looking back at the thread, I think the timeline speaks for itself.", "Happy to share it if that helps :)"],
           ["Just to clarify, this one wasn't on my side.", "Happy to forward the receipts :)"]] },

    { id: 'deadline', feel: 'impatient', why: "you're waiting on something", fallback: 'update',
      re: [/\blate\b/, /\bdeadline\b/, /\boverdue\b/, /\bstill waiting\b/, /\bwhere is\b/, /\bwhen (will|are|is)\b/,
           /\basap\b/, /\bhurry\b/, /\bdelay(ed|s)?\b/, /\b(on|in) time\b/, /\bwaiting (for|on)\b/, /\bdue\b/, /\beta\b/],
      subject: ['Checking in on the {thing}', 'Following up: {Thing}', 'Overdue: {Thing}'],
      warm: [["Just checking in on the {thing}.", "Any rough idea when it might be ready? Even an estimate helps me plan."],
             ["Quick one on the {thing}.", "Anything I can do to help move it along?"]],
      straight: [["I'm waiting on the {thing} to move ahead.", "Could I get an ETA today?"],
                 ["The {thing} was due a little while ago.", "When can I expect it? Even a rough time helps."]],
      firm: [["The {thing} is now past the agreed deadline.", "Please confirm a firm delivery time by end of day."],
             ["I'm blocked until the {thing} comes through.", "Please send it, or a clear reason for the delay, by end of day."]],
      pa: [["Gently circling back on the {thing}, which I believe was due a little while ago.", "I'll keep a very close eye on my messages :)"],
           ["Just following up on the {thing}. Again.", "Any update on the ETA? :)"]] },

    { id: 'meeting', feel: 'frustrated', why: 'meetings are eating your time',
      re: [/\bmeetings?\b/, /\bwast(e|ed|ing) (of )?(my |our )?time\b/, /\bcould have been an? (email|mail|message)\b/,
           /\bcalls?\b/, /\bpointless\b/, /\bdragg?ed on\b/, /\bagenda\b/],
      subject: ['About our next meeting', 'Could this be an email?', 'Declining: meeting without an agenda'],
      warm: [["I think this one could work over chat instead of a meeting.", "Could I share my update here instead?"],
             ["I'd love to keep our next meeting a bit shorter.", "Could we have a short agenda beforehand?"]],
      straight: [["This could probably be handled in a message.", "Could we skip the call, and I'll post my update here?"],
                 ["My part of this can be done in writing.", "Could we share an agenda before the next one?"]],
      firm: [["Unless a decision is needed from me, I'll skip this one.", "I'll post my update here and catch up from the notes."],
             ["My input will be quicker in writing.", "Please share an agenda and the expected outcome for future meetings."]],
      pa: [["In the interest of everyone's time, this could probably have been a message.", "An agenda would be lovely next time :)"],
           ["Just a thought: this may not need a whole meeting.", "Happy to share my update here instead :)"]] },

    { id: 'incompetence', feel: 'disappointed', why: "the work isn't up to the standard you expected", fallback: 'work',
      re: [INSULT, /\bno idea what (they|he|she|you)('re| are|'s| is) doing\b/, /\bdon'?t know what (you|they)('re| are) doing\b/, /\b(sloppy|full of (mistakes|errors)|so many (mistakes|errors))\b/],
      subject: ['Some notes that might help', 'Process guidance (attached)', 'Quality concerns'],
      warm: [["I think this one needs a second look.", "Want to go through it together step by step?"],
             ["A few things slipped on this one, which happens.", "Happy to share some notes on how we usually do it."]],
      straight: [["This isn't quite at the standard we need yet.", "Could we go through the issues together today?"],
                 ["A few things here need fixing before it can go out.", "Could it be checked against the guidelines and resent?"]],
      firm: [["The current quality isn't something I can sign off on.", "Please review it against the guidelines before the next version."],
             ["Given the number of issues, this needs a full review.", "Please don't send it out until it's been reviewed."]],
      pa: [["A few things here may need a second look.", "Might be worth double-checking before it goes any further :)"],
           ["I think the guidelines might help with this one.", "Happy to set up a quick session on the basics :)"]] },

    { id: 'credit', feel: 'hurt', why: 'someone took credit for your work',
      re: [/\b(took|take|taking|takes|stole|steal|stealing|steals) (the |all the |my )?credit\b/, /\bmy idea\b/,
           /\bstole my\b/, /\bpresented my\b/, /\bas (yours|theirs|his|hers|(your|their|his|her) own)\b/, /\bcop(y|ied)[ -]?past\w*\b/, /\bclaim(ed|ing|s)? (it|my|the)\b/],
      subject: ['Background on the idea', 'Original proposal (for reference)', 'Attribution of work'],
      warm: [["So glad the idea landed well!", "I'd love to stay involved as it moves forward."],
             ["Great to see the idea get picked up!", "Happy to share the background work behind it."]],
      straight: [["Glad the idea is moving. For context, it came from the proposal I shared earlier.", "Could I be included when it's presented next?"],
                 ["Good to see this going ahead. It started as my proposal.", "Could we make sure the original work is credited when it's shared?"]],
      firm: [["For transparency, this was my proposal, and I have the original dated draft.", "Please include me when it's presented in future."],
             ["I'd like contributions to be credited accurately.", "Please credit the original work when this is shared."]],
      pa: [["Glad to see the idea I shared earlier getting such traction.", "As the original author, happy to answer any questions :)"],
           ["Lovely to see my proposal getting some attention.", "I've got the original draft if anyone needs it :)"]] },

    { id: 'micromanage', feel: 'frustrated', why: "you're being micromanaged",
      re: [/\bmicro-?manag/, /\bbreathing down\b/, /\bevery (two|five|ten|2|5|10|few) minutes\b/,
           /\bcheck(s|ing)? (on|up on) me\b/, /\bleave me alone\b/, /\blet me (do|work)\b/, /\bhover(s|ing)?\b/, /\bstatus updates?\b/],
      subject: ['Daily updates', 'Re: Status update', 'Proposed reporting cadence'],
      warm: [["I've got this one in hand.", "Would a quick update at the end of each day work?"],
             ["Things are moving well on this.", "I'll shout as soon as I hit anything blocking."]],
      straight: [["This is on track.", "Could we agree on one update a day, say at 5pm?"],
                 ["I've got this covered.", "I'll update at the checkpoints we agreed, and flag anything blocking straight away."]],
      firm: [["Frequent check-ins are slowing this down.", "Let's agree on one update a day at 5pm."],
             ["I'm confident I can deliver this to the agreed standard.", "I'll update at the agreed checkpoints, and I'd appreciate the space to finish."]],
      pa: [["Rest assured, this is still in hand.", "I'll share an update as soon as there's something to update on :)"],
           ["Nothing new to report since the last update, ten minutes ago.", "I'll shout if I need any input :)"]] },

    { id: 'lastminute', feel: 'overwhelmed', why: 'work is landing at the last minute',
      re: [/\blast[- ]minute\b/, /\bfriday\b/, /\bweekends?\b/, /\b(after|out of|outside( of)?) (office |working )?hours\b/,
           /\bmidnight\b/, /\b(5|6|7|8|9|10|11) ?pm\b/, /\burgent(ly)?\b/, /\bholiday\b/],
      subject: ['Your request', 'Re: URGENT (received after hours)', 'Request received outside working hours'],
      warm: [["Thanks for flagging this.", "I'll look at it first thing tomorrow, if that works?"],
             ["Happy to help where I can.", "A bit more notice next time would help me do it properly."]],
      straight: [["This has come in late, so I can't do it properly tonight.", "I'll pick it up first thing tomorrow. Does that work?"],
                 ["I've seen this, though it arrived after hours.", "Could requests like this come earlier in the week next time?"]],
      firm: [["This arrived outside working hours.", "I'll review it during working hours tomorrow."],
             ["I'll fit this into my existing priorities.", "Please allow at least two working days for requests like this."]],
      pa: [["Noting this came in quite late in the day.", "I'll pick it up first thing tomorrow :)"],
           ["Just seen this, as it arrived after hours.", "Earlier in the week would be great next time :)"]] },

    { id: 'scope', feel: 'overwhelmed', why: 'too much is landing on you',
      re: [/\bnot my (job|work|responsibility|problem|role|department)\b/, /\b(extra|more|too much|so much) work\b/,
           /\boverload(ed)?\b/, /\bon my plate\b/, /\bburn(ed|t)? ?out\b/, /\bdo (it|this|that) (yourself|urself)\b/,
           /\bnot paid (enough|for this)\b/, /\bunderpaid\b/, /\b(another|one more|new) (project|task)\b/, /\bdrowning\b/],
      subject: ['Helping with this', 'Priorities check', 'Scope and capacity'],
      warm: [["I'd love to help, but my plate is pretty full right now.", "Could we look at what can move to make room?"],
             ["I want to do this properly, and I'm at capacity at the moment.", "Which of my current tasks should come second?"]],
      straight: [["I can take this on, but something else would need to move.", "Which of my current tasks should I push back to fit it in?"],
                 ["This usually sits with another team.", "Could it go to the person who normally owns it?"]],
      firm: [["My workload is at capacity.", "Please confirm in writing which task this replaces."],
             ["This falls outside my role.", "Please raise it with the right owner."]],
      pa: [["Happy to take this on, once we agree what falls off my list.", "Just let me know which deadline I should miss :)"],
           ["This seems to sit a little outside my remit.", "Happy to point to the right person :)"]] },

    { id: 'noreply', feel: 'impatient', why: "you're not getting replies",
      re: [/\bignor(e|ed|es|ing)\b/, /\bno (reply|response|answer)\b/,
           /\b(never|didn'?t|did not|don'?t|doesn'?t|won'?t) (reply|respond|answer|get back|call back)\b/,
           /\bghost(ed|ing|s)?\b/, /\bleft (me )?on (read|seen)\b/, /\bfollow(ing)? up\b/],
      subject: ['Bumping this up', 'Following up', 'Final follow-up'],
      warm: [["Just bumping this in case it got buried.", "No rush, just want to make sure it reached you."],
             ["Hope all's well!", "Did you get a chance to look at my earlier message?"]],
      straight: [["Following up on my message from earlier, as I haven't heard back.", "Could I get a reply by end of day, even a quick yes or no?"],
                 ["Bumping this one.", "Is it still a priority, or should I close it?"]],
      firm: [["I've followed up several times without a reply.", "If this is no longer a priority, please say so and I'll close it."],
             ["This is now holding up other work.", "Without a reply by Friday, I'll go ahead as planned."]],
      pa: [["Bumping this again, as I haven't heard back yet.", "I'm sure you're busy, so a quick yes or no is fine :)"],
           ["Circling back on this one. Again.", "Any update? :)"]] },

    { id: 'mindchange', feel: 'frustrated', why: 'the goalposts keep moving',
      re: [/\bchang(e|ed|es|ing) (your|their|his|her|the) (mind|minds|requirements?|brief|plan)\b/,
           /\bkeeps? changing\b/, /\bmake up (your|their|his|her) mind\b/, /\bflip[- ]?flop/,
           /\bnew (requirements?|brief)\b/, /\bgoal ?posts?\b/, /\bredo(ing)?\b/],
      subject: ['Confirming the latest version', 'Updated brief (v4)', 'Change control'],
      warm: [["Thanks for the update, happy to adjust.", "Could we confirm the latest version so I get it right this time?"],
             ["No problem.", "Could we lock in the final requirements so I can build on something solid?"]],
      straight: [["The brief has changed a few times now, and each change resets the timeline.", "Could we freeze it after today so I can commit to a date?"],
                 ["Happy to update this.", "Could all the changes come in one list so nothing gets missed?"]],
      firm: [["Each change has reset the timeline.", "Please send one final list of changes. Anything after that will be a new request."],
             ["To avoid more rework, I'll pause until the requirements are confirmed.", "Please confirm them in writing before I continue."]],
      pa: [["Noted, and updating again.", "Could we confirm these are the final requirements? :)"],
           ["Happy to change it, and I'll keep the previous version handy in case we switch back.", "Just say the word :)"]] },

    { id: 'replyall', feel: 'frustrated', why: 'the thread is getting out of hand',
      re: [/\breply[- ]?all\b/, /\bcc'?d?\b/, /\bspam(s|med|ming)?\b/, /\btoo many (emails|messages|mails|notifications)\b/,
           /\b(emails|messages|pings) all day\b/, /\bgroup chat\b/],
      subject: ['Moving this thread', 'Removing the wider group', 'Email etiquette'],
      warm: [["This thread is getting busy.", "Could we take it to a smaller chat?"],
             ["Happy to pick this up directly.", "Shall we move it to a DM?"]],
      straight: [["This no longer needs the whole group.", "Could we continue it in a DM?"],
                 ["Moving this to a smaller thread.", "Let's keep it to the people who need to act."]],
      firm: [["This thread no longer needs the wider group.", "Please reply only to the people who need to act."],
             ["This discussion has outgrown the group chat.", "Please continue it with only the people involved."]],
      pa: [["Moving this to a smaller thread to save everyone's notifications.", "DMs might work better for this one :)"],
           ["I think the whole group now knows a lot about this.", "Maybe a DM from here? :)"]] },

    { id: 'calledout', feel: 'hurt', why: 'you were criticised in front of others',
      re: [/\bin front of (everyone|the (whole )?(team|client|others|group|room)|people|others)\b/, /\bpublicly\b/,
           /\bcalled me out\b/, /\b(criticis|criticiz)\w* (me|my work)\b/, /\bhumiliat\w*\b/, /\bembarrass\w* me\b/],
      subject: ['About earlier', 'Feedback, one-to-one', 'Raising a concern about feedback'],
      warm: [["About earlier in front of the team, I'd find it easier to hear feedback like that one-to-one.", "Could we chat about it privately?"],
             ["I'm keen to hear feedback on my work, and it's easier for me one-to-one.", "Could we find ten minutes to go through it?"]],
      straight: [["I'd prefer feedback on my work to come to me directly, not in front of the team.", "Could we talk it through one-to-one today?"],
                 ["Feedback on my work lands better one-to-one than in front of everyone.", "Can we go through the points privately today?"]],
      firm: [["Feedback like that shouldn't be given in front of the team.", "Please raise any concerns about my work with me directly."],
             ["Criticism of my work belongs in a one-to-one, not in front of the team.", "Please bring any issues to me privately from now on."]],
      pa: [["Thanks for the feedback earlier, though one-to-one might be a better place for it next time.", "My DMs are always open :)"],
           ["Always grateful for feedback, even with a live audience.", "Happy to do the next round one-to-one :)"]] },

    { id: 'leftout', feel: 'hurt', why: 'you were left out',
      re: [/\bleft out\b/, /\bnot invited\b/, /\bexclud\w*\b/, /\bwithout (me|asking me|telling me)\b/, /\bbehind my back\b/,
           /\b(nobody|no one|no-one) (told|asked|invited|informed) me\b/, /\bwas(n'?t| not) (told|informed|included|invited)\b/],
      subject: ['Keeping me in the loop', 'Being included', 'Decisions affecting my work'],
      warm: [["I noticed I wasn't included in this one.", "Could I be looped in next time? I'd love to help."],
             ["I only just heard about this, and I'd have liked to be part of it.", "Could I join the next one?"]],
      straight: [["I wasn't included in this, and it affects my work.", "Could I be added to these discussions from now on?"],
                 ["I found out about this after the fact, and it touches my work.", "Can I be on the invite for the next one?"]],
      firm: [["I wasn't included in a decision that affects my work.", "Please include me in future discussions on this."],
             ["Decisions about my work were made without me.", "Please keep me informed before changes like this are agreed."]],
      pa: [["Just saw this. I must have missed the invite.", "Happy to be looped in next time :)"],
           ["Fun to find out about this second-hand.", "My calendar is wide open for the next one :)"]] }
  ];

  // No situation found: the feeling decides what the message asks for.
  var GENERIC = {
    frustrated: { warm: [["There's something here I'd like to talk through.", "Could we find ten minutes today?"]],
      straight: [["This isn't working well, and I'd like to fix it.", "Could we talk it through today?"]],
      firm: [["I'd like to raise a concern about how this has been handled.", "Please let me know when we can discuss it this week."]],
      pa: [["Well, that went well.", "Could we chat about how to avoid a repeat? :)"]] },
    angry: { warm: [["I'm not happy with how this went, and I'd like to sort it out.", "Could we talk today?"]],
      straight: [["This needs to be fixed, and I'd like to understand what happened.", "Can we talk about it today?"]],
      firm: [["This is not acceptable, and I'd like to raise it formally.", "Please let me know when we can discuss it."]],
      pa: [["Well, that didn't go to plan.", "Let's chat about how to stop it happening again :)"]] },
    overwhelmed: { warm: [["I've got a lot on right now, and I want to do this well.", "Could we go over priorities together?"]],
      straight: [["My plate is full at the moment.", "Could we agree what comes first?"]],
      firm: [["My current workload isn't sustainable.", "Please confirm priorities so I can plan what moves."]],
      pa: [["My plate is looking rather full at the moment.", "Just let me know which fire to put out first :)"]] },
    anxious: { warm: [["I want to make sure I get this right.", "Could I get a quick steer on what's expected?"]],
      straight: [["Before I go further, I want to check I'm on the right track.", "Could we confirm what done looks like, and by when?"]],
      firm: [["I need clarity before I go further.", "Please confirm the requirements and the deadline."]],
      pa: [["Just want to double-check I'm on the right track, as the brief was a little open.", "A quick confirmation would be lovely :)"]] },
    confused: { warm: [["I'm not sure I've fully understood this one.", "Could I get a quick walkthrough?"]],
      straight: [["I'm not clear on what's needed here.", "What's the one thing needed from me, and by when?"]],
      firm: [["The request isn't clear as it stands.", "Please set out exactly what's needed and by when."]],
      pa: [["I may be missing something here.", "Could someone clarify what's needed? :)"]] },
    hurt: { warm: [["Something earlier didn't sit right with me.", "Could we talk it through?"]],
      straight: [["What happened earlier didn't land well with me.", "Could we talk about it one-to-one?"]],
      firm: [["I didn't think that was appropriate.", "Please keep feedback specific and respectful."]],
      pa: [["I noticed how that came across earlier.", "Happy to chat about it if useful :)"]] },
    disappointed: { warm: [["I was hoping this would go differently.", "Could we look at what happened and how to fix it?"]],
      straight: [["This isn't what we agreed.", "What's the plan to get it back on track?"]],
      firm: [["This doesn't meet what was agreed.", "Please share a plan to put it right."]],
      pa: [["This isn't quite what we agreed, but I'm sure it was a busy week.", "Could we get it back on track? :)"]] },
    impatient: { warm: [["Just keen to keep this moving.", "Any update when there's a sec?"]],
      straight: [["Checking in on this again.", "Could I get an update today?"]],
      firm: [["This needs to move forward today.", "Please send an update by end of day."]],
      pa: [["Just checking in on this again.", "Any news? :)"]] },
    neutral: { warm: [["There are a couple of things here I'd like to talk through.", "Do you have ten minutes today?"]],
      straight: [["I'd like to flag a couple of points on this.", "Could we go through them today?"]],
      firm: [["I'd like to set out my position clearly.", "Please let me know a time to discuss it."]],
      pa: [["I'm sure this was just an oversight.", "Worth a second look, though :)"]] }
  };

  // A soft "I feel" line, used only at the Warm level (Nonviolent Communication style).
  // Angry, frustrated and impatient are left out: naming those in a sent message tends to escalate.
  var FEEL_LINE = {
    overwhelmed: ["I'm quite stretched at the moment.", "Being honest, I'm a bit stretched right now."],
    anxious: ["I'm a little worried about getting this right.", "I want to be sure I get this right."],
    hurt: ["Being honest, this one stung a bit.", "I'll be honest, this didn't sit well with me."],
    confused: ["I'm a bit unsure on this one.", "I might be missing something here."],
    disappointed: ["I was hoping this would go a bit differently.", "I'll be honest, I'd hoped for a different result."]
  };

  /* ---------- Small helpers ---------- */

  var NOUNS = /\b(report|deck|slides|presentation|document|doc|spreadsheet|invoice|code|ticket|proposal|contract|designs?|budget|data|numbers|figures|summary|draft|analysis|forecast|minutes|payment|quote|estimate|brief|pull request|pr|release|build|notes|form|application|files?|sheet|update|approval|feedback|plan|review|task)\b/;
  var NOUN_FIX = { doc: 'document', pr: 'pull request' };

  // What the message is about: [pattern, clean phrase]. First match wins, so specific entries come first.
  // The phrase is ours, so nothing rude from the original message can reach the reply.
  var TOPICS = [
    [/\b(fridge|my food|my lunch from|eat(s|ing)? my)\b/, 'food going missing from the fridge'],
    [/\bmicrowav\w*|\bsmell\w*\b/, 'food smells in the pantry'],
    [/\b(mugs?|dishes|sink)\b/, 'dirty dishes in the sink'],
    [/\b(washroom|toilet|restroom|bathroom)s?\b/, 'the washroom'],
    [/\blunch\b|\bwhen i (sit down to )?eat\b/, 'my lunch break'],
    [/\bvoice (notes?|messages?)\b/, 'voice notes'],
    [/\btag(s|ging|ged)? me\b|\bmention(s|ing)? me\b/, 'being tagged in every message'],
    [/\b(reply|replying|replies) all\b/, 'reply-all threads'],
    [/\bcall\w*\b.*\b(\d{1,2} ?pm|night|midnight)\b|\b(\d{1,2} ?pm|night|midnight)\b.*\bcall\w*\b/, 'calls after hours'],
    [/\b(midnight|late at night|whatsapp|1[01] ?pm|[1-4] ?am)\b/, 'messages after hours'],
    [/\bnight shift\b/, 'the night shift'],
    [/\bcomp[ -]?off\b/, 'comp off for the weekend we worked'],
    [/\b(weekends?|saturday|sunday)\b/, 'weekend work'],
    [/\bsick (day|leave)s?\b/, 'how sick days are treated'],
    [/\bwork from home\b|\bwfh\b/, 'my cancelled work from home day'],
    [/\bleave( request| application)?\b(?! me\b)(?! early\b)/, 'my leave request'],
    [/\b(medical|certificate|health)\b/, 'my medical details'],
    [/\b(shared|told|forwarded)\b.*\bsalary\b/, 'my salary details'],
    [/\bbonus\b/, 'my bonus'],
    [/\b(hike|increment)\b|\b\d+ ?(%|percent)\b/, 'my salary hike'],
    [/\b(raise|pay rise)\b/, 'a pay rise'],
    [/\b(salary|compensation|ctc)\b|\bpay\b(?! for)/, 'my salary'],
    [/\bappraisal|\brating\b/, 'my appraisal'],
    [/\bpromot(ion|ed|e)\b/, 'my promotion'],
    [/\b(title|designation|team lead role|role)\b/, 'my role and title'],
    [/\breplacement\b/, 'training my replacement'],
    [/\b(talks? over|talking over|cut(s|ting)? me off|interrupt\w*)\b/, 'being interrupted when I speak'],
    [/\bcover(ing)? for\b/, 'covering for others'],
    [/\b1:1s?\b|\bone[- ]on[- ]ones?\b|\bone-to-ones?\b/, 'our 1:1s'],
    [/\bstandups?\b/, 'standup'],
    [/\b[5-8] ?am\b|\bearly (morning )?meetings?\b/, 'the early morning meetings'],
    [/\b(reorg|restructur\w*)\b/, 'the reorg'],
    [/\b(production|prod)\b/, 'the production issue'],
    [/\b(the|a) build\b/, 'the broken build'],
    [/\b(release|deploy\w*)\b.*\b(broke\w*|crash\w*|fail\w*)\b|\bbroke\w*\b.*\brelease\b/, 'the broken release'],
    [/\brelease\b/, 'the release'],
    [/\b(code )?review comments?\b/, 'the review comments'],
    [/\b(pr|pull request)\b/, 'my pull request review'],
    [/\b(printer|scanner|projector)\b/, 'the $1'],
    [/\bcoffee machine\b/, 'the coffee machine'],
    [/\b(ac|air ?con\w*|temperature|heating)\b/, 'the AC'],
    [/\b(wifi|wi-fi|internet|network)\b/, 'the wifi'],
    [/\b(laptop|computer|pc)\b/, 'my laptop'],
    [/\bmonitor\b/, 'my monitor request'],
    [/\bcharger\b/, 'my charger'],
    [/\bparking\b/, 'my parking spot'],
    [/\b(conference|meeting|training) room\b|\bbook(ed|ing|s)? the\b.*\broom\b/, 'the room bookings'],
    [/\bshared drive\b|\bfolders?\b/, 'the shared drive'],
    [/\bonboarding\b/, 'the onboarding docs'],
    [/\btracker\b/, 'the tracker'],
    [/\bbudget\b/, 'the budget'],
    [/\b(reimburs\w*|expense claims?|travel claims?)\b/, 'my reimbursement'],
    [/\brefund\b/, 'the refund'],
    [/\b(invoice|payment)\b/, 'the overdue payment'],
    [/\b(discount\w*|price|pricing)\b/, 'the agreed price'],
    [/\b(revisions?|fixed fee)\b/, 'the number of revisions'],
    [/\b(extra|new) (features?|hours|work)\b|\bscope\b/, 'the extra scope'],
    [/\blogo\b/, 'the logo changes'],
    [/\bredesign\b|\bwebsite\b/, 'the redesign timeline'],
    [/\bdemo\b/, 'the demo'],
    [/\bpresentation\b/, 'the presentation'],
    [/\b(training|new tool)\b/, 'training on the new tool'],
    [/\bbrief\b/, 'the brief'],
    [/\blaunch\b/, 'the launch'],
    [/\bcomplaints?\b/, 'customer complaints'],
    [/\btickets?\b/, 'how tickets are shared'],
    [/\b(intern|same questions?)\b/, 'the repeated questions'],
    [/\b(vendor|supplier)\b.*\b(parts|boxes|order|deliver\w*|shipped)\b|\b(parts|boxes|shipment)\b/, 'the delivery'],
    [/\bwrong (parts|items|order)\b/, 'the mix-up with the parts'],
    [/\bon hold\b/, 'a response from support'],
    [/\bproject\b/, 'the project'],
    [/\bdeadline\b/, 'the deadline'],
    [/\bfeedback\b/, 'the feedback'],
    [/\bnumbers\b/, 'my numbers'],
    [/\b(emails?)\b/, 'the emails']
  ];

  // Situations whose keywords are loose ("calls", "late", "again"): one weak hit should not beat a clear topic.
  var LOOSE = { meeting: 1, deadline: 1, repeat: 1, noreply: 1, notread: 1, incompetence: 1, scope: 1, mindchange: 1, leftout: 1 };

  // No situation (or a weak one), but we know the topic: name it, then the feeling decides the ask.
  // With no clear feeling, the generic ask would talk about "points"; this one fits a named topic.
  var TOPIC_ASK = { warm: 'Do you have ten minutes today?', straight: 'Could we talk it through today?',
    firm: 'Please let me know when we can discuss it.', pa: 'Worth a quick chat :)' };

  var TOPIC_SAY = {
    warm: ["I'd like to talk about {topic}.", "There's something about {topic} I'd like to talk through."],
    straight: ["I want to flag an issue with {topic}.", "I'd like to sort out {topic}."],
    firm: ["I need to raise a concern about {topic}.", "I'd like {topic} dealt with properly."],
    pa: ["Just a gentle note about {topic}.", "Bringing up {topic} again, in case it slipped through."]
  };
  var NUMBER_WORDS = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    eleven: 11, twelve: 12, fifteen: 15, twenty: 20 };
  var WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
    'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
  var ORDINALS = ['zeroth', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth',
    'eleventh', 'twelfth', 'thirteenth', 'fourteenth', 'fifteenth', 'sixteenth', 'seventeenth', 'eighteenth',
    'nineteenth', 'twentieth', 'twenty-first'];
  var HYPERBOLE = /\b(hundred|hundreds|thousand|thousands|million|millions|billion|zillion|many|countless|umpteen|so many|n)\s+times\b|\b\d{3,}\s+times\b/;
  var CURLY = new RegExp('[' + String.fromCharCode(0x2018, 0x2019, 0x60) + ']', 'g');
  var YOU = /\byou(r|rs|'re|'ll|'ve|'d)?\b/i;

  function normalise(text) {
    return String(text || '').toLowerCase().replace(CURLY, "'").replace(/\s+/g, ' ').trim();
  }

  function hash(s) {
    var h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return h;
  }

  function findCount(t) {
    if (HYPERBOLE.test(t)) return { count: 'countless', countth: 'umpteenth' };
    if (/\btwice\b/.test(t)) return { count: 'two', countth: 'third' };
    var m = t.match(/\b(\d{1,2}|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty)\s+times\b/);
    if (!m) return null;
    var n = /^\d+$/.test(m[1]) ? parseInt(m[1], 10) : NUMBER_WORDS[m[1]];
    if (!n || n < 2) return null;
    if (n > 20) return { count: String(n), countth: 'umpteenth' };
    return { count: WORDS[n], countth: ORDINALS[n + 1] };
  }

  function findThing(t) {
    var m = t.match(NOUNS);
    if (!m) return null;
    return NOUN_FIX[m[1]] || m[1];
  }

  // The first topic that matches; with `allowed`, the first one on that list.
  function findTopic(t, allowed) {
    for (var i = 0; i < TOPICS.length; i++) {
      if (allowed && allowed.indexOf(TOPICS[i][1]) < 0) continue;
      var m = t.match(TOPICS[i][0]);
      if (m) return TOPICS[i][1].replace('$1', m[1] || '');
    }
    return null;
  }

  function fill(tpl, vars) {
    return tpl.replace(/\{(\w+)\}/g, function (all, key) { return vars[key] != null ? vars[key] : all; });
  }

  function pick(list, seed) { return list[seed % list.length]; }

  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  /* ---------- Reading the message ---------- */

  function detectCats(t) {
    var found = [];
    CATS.forEach(function (c, i) {
      if (c.not && c.not.test(t)) return;
      var score = 0;
      c.re.forEach(function (r) { if (r.test(t)) score++; });
      // "again" alone is weak evidence of repetition; it needs another hint.
      if (c.id === 'repeat' && score === 1 && /\bagain\b/.test(t)) score = 0;
      if (score) found.push({ cat: c, score: score, order: i });
    });
    found.sort(function (a, b) { return b.score - a.score || a.order - b.order; });
    return found.slice(0, 3);
  }

  function analyse(text) {
    var raw = String(text || '');
    var t = normalise(raw);
    var hits = detectCats(t);
    var cats = hits.map(function (h) { return h.cat; });
    var scores = {}, words = [];
    FEELING_ORDER.forEach(function (f) { scores[f] = 0; });

    CUES.forEach(function (cue) {
      var m = t.match(cue[1]);
      if (m) {
        scores[cue[0]] += cue[2] || 1;
        var w = m[0].trim();
        if (w && words.indexOf(w) < 0) words.push(w);
      }
    });
    cats.forEach(function (c, i) { scores[c.feel] += i === 0 ? 1.5 : 0.5; });
    // Show the words that pointed to the main situation too.
    if (cats.length) cats[0].re.forEach(function (r) {
      var m = t.match(r);
      if (m && m[0].trim().length > 2 && words.indexOf(m[0].trim()) < 0) words.push(m[0].trim());
    });

    // How hot is it?
    var capsWords = (raw.match(/\b[A-Z]{2,}\b/g) || []).filter(function (w) { return ['ASAP', 'ETA', 'PR', 'EOD', 'OK'].indexOf(w) < 0; });
    var shouting = capsWords.length >= 3;
    var boosters = (t.match(BOOSTERS) || []).length;
    var heat = 0;
    if (shouting) { heat += 2; words.push('ALL CAPS'); }
    if (/[!?]{2,}/.test(raw)) heat += 1;
    if (SWEAR.test(t)) heat += 2;
    if (INSULT.test(t)) heat += 1;
    if (boosters >= 2) heat += 1;
    if (ABSOLUTE.test(t)) heat += 1;
    if (shouting) scores.angry += 1;

    var best = 'neutral', bestScore = 0, second = 0;
    FEELING_ORDER.forEach(function (f) {
      if (scores[f] > bestScore) { second = bestScore; bestScore = scores[f]; best = f; }
      else if (scores[f] > second) second = scores[f];
    });

    var abs = t.match(ABSOLUTE), faux = t.match(FAUX);
    return {
      feeling: best,
      strong: heat >= 2,
      heat: heat,
      sure: bestScore >= 2 && bestScore - second >= 1,
      words: words.slice(0, 4),
      categories: cats.map(function (c) { return c.id; }),
      leadScore: hits.length ? hits[0].score : 0,
      topic: findTopic(t),
      reason: cats.length ? cats[0].why : '',
      // Repeating yourself and not being read are the same complaint, so don't count it twice.
      also: cats.slice(1).filter(function (c) {
        return !(/^(repeat|notread)$/.test(c.id) && /^(repeat|notread)$/.test(cats[0].id));
      }).map(function (c) { return c.why; }),
      absolute: abs ? abs[0] : null,
      faux: faux ? { word: faux[1], feel: FAUX_NEED[faux[1]][0], need: FAUX_NEED[faux[1]][1] } : null
    };
  }

  /* ---------- Writing the message ---------- */

  function choosePair(pairs, seed, group) {
    var pool = pairs;
    if (group) {
      var safe = pairs.filter(function (p) { return !YOU.test(p[0] + ' ' + p[1]); });
      if (safe.length) pool = safe;
    }
    return pick(pool, seed).slice();
  }

  // Group chats: don't single anyone out.
  function forGroup(s) {
    return s.replace(/\bCould you\b/g, 'Could someone').replace(/\bcould you\b/g, 'could someone')
      .replace(/\bDid you\b/g, 'Did anyone').replace(/\bDo you have\b/g, 'Does anyone have')
      .replace(/\bWant me to walk you through it\b/g, 'Want me to walk everyone through it')
      .replace(/\bit reached you\b/g, 'it reached everyone');
  }

  function compose(text, opts) {
    opts = opts || {};
    var level = Math.max(0, Math.min(2, opts.level == null ? 1 : opts.level | 0));
    var pa = !!opts.pa;
    var key = pa ? 'pa' : KEYS[level];
    var who = RECIPIENTS.indexOf(opts.to) >= 0 ? opts.to : 'teammate';
    var group = who === 'group';
    var format = opts.format === 'email' ? 'email' : 'chat';
    var version = opts.version | 0;
    var t = normalise(text);
    var seed = hash(t) + version;
    var a = analyse(text);
    var feeling = FEELINGS[opts.feeling] ? opts.feeling : a.feeling;
    var count = findCount(t);
    var thing = findThing(t);

    var lead = null;
    for (var i = 0; i < CATS.length; i++) if (CATS[i].id === a.categories[0]) lead = CATS[i];
    var topic = a.topic;
    // A loose one-word match ("calls", "late") loses to a clear topic.
    if (lead && LOOSE[lead.id] && a.leadScore < 2 && topic && !(lead.count && count)) lead = null;
    // No listed topic: the work noun ("the report") still names it when there's no situation.
    if (!lead && !topic && thing) topic = 'the ' + (thing === 'update' ? 'updates' : thing);

    var pair;
    if (lead) {
      pair = choosePair(lead[key], seed, group);
      if (lead.count && count) pair[0] = pick(lead.count[key], seed);
    } else {
      pair = choosePair(GENERIC[feeling][key], seed, group);
      if (topic) {
        pair[0] = pick(TOPIC_SAY[key], seed);
        if (feeling === 'neutral') pair[1] = TOPIC_ASK[key];
      }
    }
    // A situation with its own wording only takes topics that fit it; otherwise its own default.
    if (lead && lead.topics) topic = findTopic(t, lead.topics);

    var vars = { thing: thing || (lead && lead.fallback) || 'work' };
    vars.Thing = cap(vars.thing);
    vars.topic = topic || (lead && lead.tf) || 'this';
    vars.Topic = cap(vars.topic);
    if (count) { vars.count = count.count; vars.countth = count.countth; }

    var lines = [cap(fill(pair[0], vars)), fill(pair[1], vars)];
    if (!pa && level === 0 && lead && FEEL_LINE[feeling]) lines.unshift(pick(FEEL_LINE[feeling], seed + 2));
    if (group) lines = lines.map(forGroup);
    if (who === 'client' || who === 'manager' || format === 'email') lines = lines.map(function (l) { return l.replace(/\s*:\)/g, '').replace(/([^.!?])$/, '$1.'); });

    var name = String(opts.name || '').trim();
    var r = {
      format: format, level: level, levelName: pa ? 'Passive-aggressive' : LEVELS[level], pa: pa, to: who,
      feeling: feeling, feelingLabel: FEELINGS[feeling].label, detected: a, categories: a.categories.length ? a.categories : ['generic'],
      topic: topic, lines: lines
    };

    if (format === 'chat') {
      var greet = '';
      if (group) greet = 'Hi all,';
      else if (name) greet = (who === 'teammate' && level === 0 ? 'Hey ' : 'Hi ') + name + ',';
      else if (who === 'client' || who === 'manager') greet = 'Hi,';
      r.greeting = greet;
      var body = lines.join(' ');
      if (greet && !/^I\b|^I'/.test(body)) body = body.charAt(0).toLowerCase() + body.slice(1);
      r.text = greet ? greet + ' ' + body : body;
    } else {
      var subj = (lead ? lead.subject : ['A few thoughts', 'A couple of points', 'For the record'])[pa ? 1 : level];
      r.subject = fill(subj, vars);
      var hello = name || (group ? 'all' : '');
      r.greeting = level === 2 && !pa ? (hello ? 'Dear ' + hello + ',' : 'Hello,') : 'Hi ' + (hello || 'there') + ',';
      r.opener = pa ? 'I hope this email finds you well.' : level === 0 ? "I hope you're doing well." : '';
      r.closer = pa ? 'Thanks in advance for your prompt attention to this.' : level === 0 ? 'Thanks so much for your help.' : '';
      r.signoff = pa ? 'Kind regards,' : ['Best wishes,', 'Best,', 'Regards,'][level];
    }
    return r;
  }

  function toPlainText(r, from) {
    if (r.format === 'chat') return r.text;
    var out = ['Subject: ' + r.subject, '', r.greeting, ''];
    if (r.opener) out.push(r.opener, '');
    out.push(r.lines.join(' '), '');
    if (r.closer) out.push(r.closer, '');
    out.push(r.signoff);
    if (from && String(from).trim()) out.push(String(from).trim());
    return out.join('\n');
  }

  /* ---------- Checking AI-written messages ---------- */
  // The AI writes three versions; these rules decide which ones are fit to show, and in what order.

  var SHOUT = /\b[A-Z]{5,}\b/;
  var ASK = /\?|\b(please|could|can we|can you|can i|would you|would it|let'?s|shall we|i'?ll|i will|let me know)\b/i;
  var GREETING = /^\s*(hi|hello|hey|dear|good (morning|afternoon|evening))\b[^,.!]*[,.!]?\s*/i;
  var NON_ASCII_SYMBOL = new RegExp('[' + String.fromCharCode(0x2600) + '-' + String.fromCharCode(0x27BF) + ']|[' +
    String.fromCharCode(0xD83C) + '-' + String.fromCharCode(0xD83E) + '][' + String.fromCharCode(0xDC00) + '-' + String.fromCharCode(0xDFFF) + ']', 'g');

  // Tidy what the model wrote: drop a leading greeting, emoji, wrapping quotes and extra spaces.
  function tidy(text) {
    return String(text || '').replace(NON_ASCII_SYMBOL, '').replace(CURLY, "'")
      .replace(new RegExp('[' + String.fromCharCode(0x201C, 0x201D) + ']', 'g'), '"')
      .replace(/^\s*["']|["']\s*$/g, '').replace(GREETING, '').replace(/\s+/g, ' ').replace(/\s+([.,!?])/g, '$1').trim()
      .replace(/^./, function (c) { return c.toUpperCase(); });
  }

  function sentenceCount(s) {
    return (s.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) || []).filter(function (x) { return /\w/.test(x); }).length;
  }

  function mentionsDetail(text, details) {
    var t = normalise(text);
    return (details || []).some(function (d) {
      var words = normalise(d).split(/[^a-z0-9:%'-]+/).filter(function (w) { return w.length >= 3 || /\d/.test(w); });
      return words.some(function (w) { return t.indexOf(w) >= 0; });
    });
  }

  function checkMessage(text, details, opts) {
    opts = opts || {};
    var problems = [];
    var t = normalise(text);
    if (!t || t.length < 15) problems.push('empty');
    if (sentenceCount(text) > 3) problems.push('too many sentences');
    if (text.split(/\s+/).length > 60) problems.push('too long');
    if (SWEAR.test(t) || INSULT.test(t)) problems.push('rude word');
    if (SHOUT.test(text)) problems.push('shouting');
    if (/\byou (always|never)\b/.test(t)) problems.push('always/never');
    if (!opts.pa && /\b(per my last|as per my previous|as i already said)\b/.test(t)) problems.push('passive-aggressive');
    if (!ASK.test(text)) problems.push('no ask');
    if ((text.match(/\?/g) || []).length > 2) problems.push('too many questions');
    if (opts.to === 'group' && /^you\b/i.test(text)) problems.push('singles someone out');
    if (details && details.length && !mentionsDetail(text, details)) problems.push('misses the details');
    if (!opts.warm && /\b(angry|furious|pissed)\b/.test(t)) problems.push('names anger');
    return { ok: problems.length === 0, problems: problems };
  }

  // Tidy, check and order the versions: the ones that pass come first, shortest ask first.
  function rankVersions(versions, details, opts) {
    var seen = {};
    return (versions || []).map(tidy).filter(function (v) {
      var k = normalise(v); if (!k || seen[k]) return false; seen[k] = 1; return true;
    }).map(function (v, i) {
      var c = checkMessage(v, details, opts);
      return { text: v, ok: c.ok, problems: c.problems, order: i };
    }).sort(function (a, b) { return (b.ok - a.ok) || (a.problems.length - b.problems.length) || (a.order - b.order); });
  }

  var api = { compose: compose, analyse: analyse, toPlainText: toPlainText, checkMessage: checkMessage,
    rankVersions: rankVersions, tidy: tidy, LEVELS: LEVELS, FEELINGS: FEELINGS,
    FEELING_ORDER: FEELING_ORDER, RECIPIENTS: RECIPIENTS, _cats: CATS, _generic: GENERIC };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.WorkPhrasing = api;
})(this);
