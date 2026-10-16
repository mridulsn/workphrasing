/* workphrasing phrasebook engine.
   Turns an angry message into a professional email at one of three spice levels.
   Runs entirely in the browser (also loadable in Node for tests). It never copies the
   user's words into the output, so insults and swearing can't leak through. */
(function (root) {
  'use strict';

  var LEVELS = ['Polite', 'Passive-aggressive', 'Devastatingly professional'];

  var GREETING = [['Hi {to},'], ['Hi {to},'], ['Dear {to},']];
  var DEFAULT_TO = ['there', 'there', 'colleague'];

  var OPENERS = [
    ["I hope you're doing well.", "Hope your week is going well.", "Thanks for your patience with this."],
    ["I hope this email finds you well.", "Just circling back on this.", "Hope you're well."],
    ["I'd like to address the following, for clarity and for the record.",
     "I'll keep this brief, as I appreciate everyone's time is valuable.",
     "I'm writing to set out the position clearly."]
  ];

  var CLOSERS = [
    ["Thanks so much for your help!", "Really appreciate it, and happy to help if anything's unclear.",
     "Thanks again, and let me know if I can make this easier."],
    ["Thanks in advance for your prompt attention to this.", "I trust this clarifies things.",
     "Looking forward to your timely response."],
    ["I trust this will not need to be raised again.",
     "I look forward to this being resolved, and to not revisiting it.",
     "Please treat this email as the reference point going forward."]
  ];

  var SIGNOFFS = [['Best regards,', 'Many thanks,', 'Warm regards,'],
                  ['Kind regards,', 'Thanks in advance,', 'Best,'],
                  ['Regards,', 'Respectfully,', 'With best regards,']];

  // Each category: patterns that detect it, a subject per level, and lines per level.
  // {thing} = a work noun found in the message (or the category's fallback).
  // {count}/{countth} = how many times something was said ("three" / "fourth").
  var CATS = [
    { id: 'repeat',
      re: [/\bagain\b/, /\balready (told|said|sent|explained|mentioned|asked|shared)\b/,
           /\bhow many times\b/, /\b(\d+|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|hundred|hundreds|thousand|thousands|million|millions|zillion|many|countless|umpteen) times\b/,
           /\btwice\b/, /\brepeat(ing|ed)?\b/,
           /\b(told|said|explained|mentioned) (you|this|it|that) (before|already)\b/],
      subject: ['Quick recap', 'Re: Re: Re: Following up', 'Final reiteration (please retain for reference)'],
      countLines: [
        ["I know we've been over this {count} times now, so I've put everything in one place to make it easier.",
         "We've touched on this {count} times, so here's a short summary you can keep handy."],
        ["As highlighted in my {count} previous emails, I'm happy to resend the details for your convenience.",
         "Further to my {count} previous messages on this, please find the details below once more."],
        ["This is the {countth} time I am sharing this information. To save us both time, I suggest bookmarking this email.",
         "For the {countth} time, and for the record, the details are set out below."]
      ],
      lines: [
        ["Just in case my earlier message got buried, I've summarised the key points again below.",
         "No worries if this slipped through, I'm happy to share the details once more.",
         "I may not have explained this clearly before, so here it is again in short."],
        ["As mentioned in my previous email, and the one before that, the details are below.",
         "Per my last email, I'm resending the information for your convenience.",
         "Just to reiterate what I've shared previously, the details remain unchanged."],
        ["For the avoidance of doubt, this is the same information I have already provided.",
         "I am restating this one final time so that there is a single written reference we can both rely on.",
         "Please find below the information already shared on several occasions. I'd recommend saving it somewhere safe."]
      ] },

    { id: 'notread', fallback: 'document',
      re: [/\bread\b/, /\bblind\b/, /\bcan'?t you see\b/, /\bdid you (even )?(check|look|open)\b/,
           /\bit'?s (right )?(there|in the)\b/, /\bscroll\b/, /\battach(ed|ment)\b/],
      subject: ['The details you asked for', 'Re: As per the attached', 'Information previously provided'],
      lines: [
        ["In case it's helpful, all the details are in the attached {thing}.",
         "I've highlighted the relevant part so it's quick to find.",
         "Everything should be in my earlier note, but I'm happy to walk through it together."],
        ["Please refer to the attached {thing}, which covers this in detail.",
         "The answer can be found in my previous email, which I've included below for ease of reference.",
         "I've highlighted the relevant section, in case it was missed the first time."],
        ["The information requested is contained in full in the {thing} sent previously. I have taken the liberty of highlighting it.",
         "I'd kindly ask that the material provided is reviewed before further questions are raised, as this will save us both considerable time.",
         "To be clear, this was covered in its entirety in my earlier email, in the first paragraph."]
      ] },

    { id: 'blame',
      re: [/\b(your|ur) fault\b/, /\bnot my fault\b/, /\bblam(e|ed|ing)\b/, /\bbecause of you\b/,
           /\byou (messed|screwed|broke|ruined|mess(ed)? up)\b/, /\bunder the bus\b/, /\byou did (this|it|that)\b/],
      subject: ['Working out what happened', 'Clarifying ownership', 'Record of events'],
      lines: [
        ["I think there may have been a mix-up somewhere, so let's work out together what happened.",
         "Could we take a quick look at how this came about, so it doesn't catch either of us out again?",
         "I'm keen we fix this rather than look for fault, so here's what I know so far."],
        ["Just to clarify ownership going forward, I've outlined who was responsible for each step below.",
         "I'm happy to help resolve this, though I'd note this sat outside my area.",
         "Looking back at the email trail, I think the timeline speaks for itself."],
        ["For accuracy, I have attached the full email trail, which clearly sets out where responsibility for this sat.",
         "I'm happy to support the fix. I am not, however, in a position to accept responsibility for a decision I was not part of.",
         "Going forward, I will be documenting handovers in writing so that accountability is clear to everyone involved."]
      ] },

    { id: 'deadline', fallback: 'update',
      re: [/\blate\b/, /\bdeadline\b/, /\boverdue\b/, /\bstill waiting\b/, /\bwhere is\b/, /\bwhen (will|are|is)\b/,
           /\basap\b/, /\bhurry\b/, /\bdelay(ed|s)?\b/, /\b(on|in) time\b/, /\bwaiting (for|on)\b/, /\bdue\b/],
      subject: ['Checking in on the {thing}', 'Gentle reminder: {Thing}', 'Overdue: {Thing}'],
      lines: [
        ["Just checking in on the {thing}. Is there anything I can do to help move it along?",
         "Could you share a rough timeline for the {thing}? Even an estimate would help me plan.",
         "Totally understand things get busy. When do you think the {thing} might be ready?"],
        ["Just following up on the {thing}, which I believe was due a little while ago.",
         "Gently circling back on the {thing}. Do we have an updated ETA?",
         "I'm sure the {thing} is almost ready, so I'll keep a close eye on my inbox."],
        ["The {thing} is now past the agreed deadline. Please confirm a firm delivery date by end of day.",
         "To manage expectations upstream, I will need the {thing}, or a clear explanation of the delay, by close of business today.",
         "I have been unable to progress my own work while waiting on the {thing}, and would appreciate it being prioritised accordingly."]
      ] },

    { id: 'meeting',
      re: [/\bmeetings?\b/, /\bwast(e|ed|ing) (of )?(my |our )?time\b/, /\bcould have been an? (email|mail)\b/,
           /\bcalls?\b/, /\bpointless\b/, /\bdragg?ed on\b/, /\bagenda\b/],
      subject: ['About our next meeting', 'Could this be an email?', 'Declining: meeting without an agenda'],
      lines: [
        ["Would it be okay to handle this over email? I think it could save everyone a bit of time.",
         "Could we keep the next one to 15 minutes with a short agenda? I think we'd get through it quicker.",
         "Happy to join, though I'd love to see the agenda beforehand so I can come prepared."],
        ["In the interest of everyone's time, perhaps this could be handled over email.",
         "Let's take this offline so we can respect everyone's schedule.",
         "Could we share an agenda in advance? It would help keep the discussion focused."],
        ["Having reviewed the agenda, I believe my input can be provided more efficiently in writing, which I'll share shortly.",
         "Unless a decision is required from me, I will be declining and catching up via the minutes.",
         "To protect focus time across the team, I'd propose that future sessions without a clear agenda or outcome are replaced with a written update."]
      ] },

    { id: 'incompetence',
      re: [/\b(stupid|idiots?|dumb|useless|incompetent|clueless|morons?|brainless|hopeless|pathetic|a joke)\b/,
           /\bno idea what\b/, /\bdon'?t know what (you|they)('re| are) doing\b/],
      subject: ['Some notes that might help', 'Process guidance (attached)', 'Quality concerns'],
      lines: [
        ["I think a quick walkthrough might help us get on the same page here.",
         "This one can be tricky, so I'm happy to share some notes on how it's usually done.",
         "Would it help if we went through it together step by step?"],
        ["I'm happy to set up a short session to go over the basics, if that would be useful.",
         "I've attached some guidance that should help clarify the process.",
         "It may be worth double-checking this against the guidelines before it goes any further."],
        ["Given the number of issues so far, I'd recommend a full review before anything else is sent out under the team's name.",
         "I have attached the relevant process documentation, which I'd suggest reading in full before the next attempt.",
         "I'd welcome clarity on who is accountable for quality here, as the current standard is not one I can sign off on."]
      ] },

    { id: 'credit',
      re: [/\b(took|take|taking|takes|stole|steal|stealing|steals) (the |all the |my )?credit\b/, /\bmy idea\b/,
           /\bstole my\b/, /\bpresented my\b/, /\bclaim(ed|ing|s)? (it|my|the)\b/],
      subject: ['Background on the idea', 'Original proposal (for reference)', 'Attribution of work'],
      lines: [
        ["So glad the idea landed well! Happy to share the background work behind it if that's useful.",
         "It was great to see the idea come up. I'd love to stay involved as it moves forward.",
         "Lovely to see it being picked up. For context, I've attached my original notes on it."],
        ["Glad to see the idea I shared on the earlier thread getting traction.",
         "As the original author of this proposal, I'm happy to answer any questions about it.",
         "For reference, I've attached my original draft from a few weeks ago."],
        ["For transparency, I have attached my original proposal, dated, so the history of this work is clear to all involved.",
         "I'm pleased the work was well received. In future, I'd appreciate being included when it is presented.",
         "I'd like to ensure contributions are accurately attributed, and have copied the relevant people for visibility."]
      ] },

    { id: 'micromanage',
      re: [/\bmicro-?manag/, /\bbreathing down\b/, /\bevery (two|five|ten|2|5|10|few) minutes\b/,
           /\bcheck(s|ing)? (on|up on) me\b/, /\bleave me alone\b/, /\blet me (do|work)\b/, /\bhover(s|ing)?\b/,
           /\bstatus updates?\b/],
      subject: ['Daily updates', 'Re: Status update', 'Proposed reporting cadence'],
      lines: [
        ["To save you checking in, I'll send a short update at the end of each day.",
         "I've got this one in hand, and I'll shout as soon as I hit anything blocking.",
         "Would a daily summary work for you? That way you're always in the loop."],
        ["I'll be sure to provide updates as soon as there is something to update on.",
         "To reduce back-and-forth, I'll share progress at agreed checkpoints rather than ad hoc.",
         "Rest assured, this is in hand. I'll let you know if I need any input."],
        ["To make the best use of both our time, I propose one written update each day at 5pm. Outside that, I will reach out if anything changes.",
         "I am confident in delivering this to the agreed standard and would appreciate the space to do so.",
         "Frequent check-ins are currently slowing delivery. I'd suggest we agree on milestones and review against those."]
      ] },

    { id: 'lastminute',
      re: [/\blast[- ]minute\b/, /\bfriday\b/, /\bweekends?\b/, /\b(after|out of|outside( of)?) (office |working )?hours\b/,
           /\bmidnight\b/, /\b(5|6|7|8|9|10|11) ?pm\b/, /\burgent(ly)?\b/, /\bholiday\b/],
      subject: ['Your request', 'Re: URGENT (received after hours)', 'Request received outside working hours'],
      lines: [
        ["Happy to help where I can. For next time, a bit more notice would let me give this the attention it deserves.",
         "I'll do my best with this. If anything similar comes up, an early heads-up would really help.",
         "Thanks for flagging. I'll take a look first thing tomorrow morning."],
        ["I'll pick this up first thing on the next working day, as it arrived after hours.",
         "Noting that this has come in rather late in the day, I'll prioritise it as best I can.",
         "Going forward, it would be great to have these requests earlier in the week."],
        ["As this request arrived outside working hours, I will review it during working hours.",
         "A lack of planning elsewhere does not automatically become an emergency here. I will fit this into my existing priorities.",
         "For future requests of this kind, please allow at least two working days so they can be handled properly."]
      ] },

    { id: 'scope',
      re: [/\bnot my (job|work|responsibility|problem|role|department)\b/, /\b(extra|more|too much|so much) work\b/,
           /\boverload(ed)?\b/, /\bon my plate\b/, /\bburn(ed|t)? ?out\b/, /\bdo (it|this|that) (yourself|urself)\b/,
           /\bnot paid (enough|for this)\b/, /\bunderpaid\b/],
      subject: ['Helping with this', 'Priorities check', 'Scope and capacity'],
      lines: [
        ["I'd love to help, but my plate is quite full right now. Could we look at what can move to make room?",
         "I want to do this properly, so could we chat about which of my current tasks should come second?",
         "Happy to point you to the right person for this one, as it usually sits with another team."],
        ["I'd be happy to take this on, once we agree which of my current priorities should be deprioritised.",
         "This seems to fall outside my current remit, but I'm happy to point you to the right person.",
         "Could you help me understand where this sits against my existing priorities?"],
        ["This falls outside the scope of my role. I'd suggest raising it with the appropriate owner.",
         "My current workload is at capacity. Taking this on will require something else to be formally deprioritised, in writing.",
         "Before I accept new work, I'd like us to review my current commitments together, so that nothing slips without visibility."]
      ] },

    { id: 'noreply',
      re: [/\bignor(e|ed|es|ing)\b/, /\bno (reply|response|answer)\b/,
           /\b(never|didn'?t|did not|don'?t|doesn'?t|won'?t) (reply|respond|answer|get back|call back)\b/,
           /\bghost(ed|ing|s)?\b/, /\bleft (me )?on (read|seen)\b/, /\bfollow(ing)? up\b/],
      subject: ['Bumping this up', 'Following up (again)', 'Final follow-up'],
      lines: [
        ["Just bumping this to the top of your inbox in case it got lost.",
         "Hope all is well! Just checking whether you had a chance to see my earlier message.",
         "No rush at all, I just wanted to make sure this reached you."],
        ["Just following up on my email below, as I haven't heard back yet.",
         "Circling back on this one, in case my previous messages didn't come through.",
         "I'm sure you're busy, so I'll keep this short: any update?"],
        ["I have now followed up several times without a response. If this is no longer a priority, please let me know so I can close it.",
         "In the absence of a reply by the end of the week, I will proceed on the basis that there are no objections.",
         "I've copied your manager for visibility, as this is now holding up other work."]
      ] },

    { id: 'mindchange',
      re: [/\bchang(e|ed|es|ing) (your|their|his|her|the) (mind|minds|requirements?|brief|plan)\b/,
           /\bkeeps? changing\b/, /\bmake up (your|their|his|her) mind\b/, /\bflip[- ]?flop/,
           /\bnew (requirements?|brief)\b/, /\bgoal ?posts?\b/],
      subject: ['Confirming the latest version', 'Re: Re: Updated brief (v4)', 'Change control'],
      lines: [
        ["Thanks for the update. Just so I get it right this time, could you confirm the latest version of what's needed?",
         "No problem. Could we lock in the final requirements so I can build on something solid?",
         "Happy to adjust! Could you send the changes in one list so nothing gets missed?"],
        ["Just to make sure I'm working from the latest version of the brief, could you confirm it in writing?",
         "Noted. Before I start again, could we confirm these are the final requirements?",
         "Happy to update this. I've attached the previous version for reference, in case we change direction again."],
        ["To avoid further rework, I will proceed only once the requirements are confirmed in writing and signed off.",
         "Each change in direction has reset the timeline. I've attached a summary of the changes so far and their impact on the delivery date.",
         "Please consolidate all changes into a single, final brief. Any changes after that point will be treated as a new request."]
      ] },

    { id: 'replyall',
      re: [/\breply[- ]?all\b/, /\bcc'?d?\b/, /\bspam(s|med|ming)?\b/, /\btoo many (emails|messages|mails)\b/,
           /\bemails? all day\b/],
      subject: ['Moving this thread', 'Removing the wider group', 'Email etiquette'],
      lines: [
        ["To keep everyone's inbox calm, maybe we could continue this in a smaller group?",
         "Happy to pick this up directly with you, so we don't fill up everyone's inbox.",
         "Would it help to move this thread to a quick chat?"],
        ["Removing the wider group from this thread to save their inboxes.",
         "Moving everyone else to BCC to spare their inboxes.",
         "Let's continue this one-to-one so we're not copying the whole team."],
        ["I have removed the distribution list from this thread. Please respond to me directly.",
         "This thread no longer requires the wider group, so I have taken the liberty of removing them.",
         "To keep communications efficient, I'd ask that future replies go only to those who need to act."]
      ] },

    { id: 'frustrated',
      re: [/\bfed up\b/, /\bsick (of|and tired)\b/, /\bhad enough\b/, /\bi'?m done\b/, /\bi quit\b/, /\bhate\b/,
           /\bannoy(ed|ing)\b/, /\bangry\b/, /\bfurious\b/, /\bfrustrat(ed|ing)\b/, /\bridiculous\b/,
           /\bunbelievable\b/, /\bwtf\b/, /\bffs\b/, /\bf+u+c+k/, /\bshit/, /\bdamn/, /\bbloody\b/, /\bcrap\b/],
      subject: ['A quick chat?', 'Process feedback', 'Formal concern'],
      lines: [
        ["I'll be honest, I'm finding this a bit difficult at the moment, and I'd value a quick chat.",
         "I want to flag that this has been a frustrating one, and I'd love to find a better way forward.",
         "Could we take a step back on this? I think a fresh look would help both of us."],
        ["I'd welcome a conversation about how we can make this process smoother, as it hasn't been working well.",
         "It's fair to say this hasn't gone as smoothly as any of us would have liked.",
         "I think it's worth pausing to reflect on how we got here."],
        ["I'd like to formally raise that the current situation is not sustainable, and request a meeting to discuss it.",
         "This has gone on for some time now. I'd appreciate a clear plan for resolving it by the end of the week.",
         "I'm keeping a record of these issues and would welcome the chance to discuss them properly."]
      ] }
  ];

  var GENERIC = {
    id: 'generic',
    subject: ['A few thoughts', 'A couple of points', 'For the record'],
    lines: [
      ["I wanted to share some thoughts on this, and I'd love to hear yours too.",
       "There are a couple of things here I'd like to talk through when you have a moment.",
       "I think we can sort this out quickly with a short conversation."],
      ["There are a few points here that I think deserve a second look.",
       "I wanted to flag a couple of things before we go any further.",
       "I'm sure this was just an oversight, but it's worth addressing."],
      ["I'd like to formally note a few concerns about how this has been handled.",
       "The following should be clearly on record.",
       "Before this goes any further, I'd like to set out my position clearly in writing."]
    ]
  };

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

  function detect(t) {
    var found = [];
    CATS.forEach(function (c, i) {
      var score = 0;
      c.re.forEach(function (r) { if (r.test(t)) score++; });
      if (score) found.push({ cat: c, score: score, order: i });
    });
    found.sort(function (a, b) { return b.score - a.score || a.order - b.order; });
    return found.slice(0, 3).map(function (f) { return f.cat; });
  }

  function fill(tpl, vars) {
    return tpl.replace(/\{(\w+)\}/g, function (all, key) {
      return vars[key] != null ? vars[key] : all;
    });
  }

  function pick(list, seed) { return list[seed % list.length]; }

  function rephrase(text, opts) {
    opts = opts || {};
    var level = Math.max(0, Math.min(2, opts.level == null ? 1 : opts.level | 0));
    var version = opts.version | 0;
    var t = normalise(text);
    var seed = hash(t) + version;
    var cats = detect(t);
    var count = findCount(t);
    var thing = findThing(t);
    var body = [];

    var used = cats.length ? cats : [GENERIC];
    used.forEach(function (c, i) {
      var vars = { thing: thing || c.fallback || 'work' };
      vars.Thing = vars.thing.charAt(0).toUpperCase() + vars.thing.slice(1);
      var pool = c.lines[level];
      if (c.countLines && count) {
        pool = c.countLines[level];
        vars.count = count.count;
        vars.countth = count.countth;
      }
      body.push(fill(pick(pool, seed + i * 7), vars));
    });

    var lead = used[0];
    var leadVars = { thing: thing || lead.fallback || 'work' };
    leadVars.Thing = leadVars.thing.charAt(0).toUpperCase() + leadVars.thing.slice(1);
    var to = (opts.to || '').trim() || DEFAULT_TO[level];

    return {
      level: level,
      levelName: LEVELS[level],
      categories: used.map(function (c) { return c.id; }),
      subject: fill(lead.subject[level], leadVars),
      greeting: fill(GREETING[level][0], { to: to }),
      opener: pick(OPENERS[level], seed + 3),
      body: body,
      closer: pick(CLOSERS[level], seed + 5),
      signoff: pick(SIGNOFFS[level], seed + 1)
    };
  }

  function toPlainText(r, from) {
    var lines = ['Subject: ' + r.subject, '', r.greeting, '', r.opener, ''];
    r.body.forEach(function (p) { lines.push(p, ''); });
    lines.push(r.closer, '', r.signoff);
    if (from && from.trim()) lines.push(from.trim());
    return lines.join('\n');
  }

  var api = { rephrase: rephrase, toPlainText: toPlainText, LEVELS: LEVELS, _cats: CATS, _generic: GENERIC };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.WorkPhrasing = api;
})(this);
