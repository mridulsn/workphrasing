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
  var CATS = [
    { id: 'repeat', feel: 'frustrated', why: "you've had to repeat yourself",
      re: [/\balready (told|said|sent|explained|mentioned|asked|shared)\b/, /\bhow many times\b/,
           /\b(\d+|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|hundred|hundreds|thousand|thousands|million|millions|zillion|many|countless|umpteen) times\b/,
           /\btwice\b/, /\brepeat(ing|ed)?( myself)?\b/, /\b(told|said|explained|mentioned) (you|this|it|that) (before|already)\b/, /\bagain\b/],
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
           /\bstole my\b/, /\bpresented my\b/, /\bclaim(ed|ing|s)? (it|my|the)\b/],
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

  function fill(tpl, vars) {
    return tpl.replace(/\{(\w+)\}/g, function (all, key) { return vars[key] != null ? vars[key] : all; });
  }

  function pick(list, seed) { return list[seed % list.length]; }

  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  /* ---------- Reading the message ---------- */

  function detectCats(t) {
    var found = [];
    CATS.forEach(function (c, i) {
      var score = 0;
      c.re.forEach(function (r) { if (r.test(t)) score++; });
      // "again" alone is weak evidence of repetition; it needs another hint.
      if (c.id === 'repeat' && score === 1 && /\bagain\b/.test(t)) score = 0;
      if (score) found.push({ cat: c, score: score, order: i });
    });
    found.sort(function (a, b) { return b.score - a.score || a.order - b.order; });
    return found.slice(0, 3).map(function (f) { return f.cat; });
  }

  function analyse(text) {
    var raw = String(text || '');
    var t = normalise(raw);
    var cats = detectCats(t);
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

    var pair;
    if (lead) {
      pair = choosePair(lead[key], seed, group);
      if (lead.count && count) pair[0] = pick(lead.count[key], seed);
    } else {
      pair = choosePair(GENERIC[feeling][key], seed, group);
    }

    var vars = { thing: thing || (lead && lead.fallback) || 'work' };
    vars.Thing = cap(vars.thing);
    if (count) { vars.count = count.count; vars.countth = count.countth; }

    var lines = [fill(pair[0], vars), fill(pair[1], vars)];
    if (!pa && level === 0 && lead && FEEL_LINE[feeling]) lines.unshift(pick(FEEL_LINE[feeling], seed + 2));
    if (group) lines = lines.map(forGroup);
    if (who === 'client' || who === 'manager' || format === 'email') lines = lines.map(function (l) { return l.replace(/\s*:\)/g, '').replace(/([^.!?])$/, '$1.'); });

    var name = String(opts.name || '').trim();
    var r = {
      format: format, level: level, levelName: pa ? 'Passive-aggressive' : LEVELS[level], pa: pa, to: who,
      feeling: feeling, feelingLabel: FEELINGS[feeling].label, detected: a, categories: a.categories.length ? a.categories : ['generic'],
      lines: lines
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

  var api = { compose: compose, analyse: analyse, toPlainText: toPlainText, LEVELS: LEVELS, FEELINGS: FEELINGS,
    FEELING_ORDER: FEELING_ORDER, RECIPIENTS: RECIPIENTS, _cats: CATS, _generic: GENERIC };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.WorkPhrasing = api;
})(this);
