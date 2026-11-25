# Roundtable

A roundtable asks the same question to two to five models, none of them seeing the others'
opinions. The conversation then compares the opinions, challenges them and gives a synthesis that
decides. Useful before a decision that matters: an architecture choice, a diagnosis, a plan.

Here you can:

- [start a roundtable](#lancer);
- [choose the participants](#participants);
- [follow the opinions](#avis);
- [read the synthesis](#synthese);
- [ask the participants to respond](#replique);
- know [what a roundtable costs](#cout).

<a id="lancer"></a>

## Start a roundtable

Type `/roundtable` followed by your question, or click the roundtable button in the composer bar,
then write the question. When the window is narrow, the button moves into the 📎 menu
(“Roundtable”); where 📎 has no menu (no screen capture), the `/roundtable` command remains. The question gets the “Roundtable” tag, and a grey line shows below it:
“3 participants ▾ + synthesis · at least 4× the tokens of a plain question”. ↩ sends.

Escape, the cross of the line, or ⌫ at the start of the question take you back to a plain question.

A roundtable does not start from a delegated task, nor in the Chat space. One roundtable at a time
per conversation: until the first has given its synthesis, the button is greyed out, and so is
`/roundtable` in the command list, with its reason. A question of
more than 8,000 characters is refused too: attach the details as a file.

<a id="participants"></a>

## Choose the participants

“3 participants ▾” opens a checkbox menu: recently used models first, then **Other models…** to
search the whole list. An agent that does not let you choose its model (IBM Bob) takes a single
line. An agent missing from this computer is not offered. Two to five participants; beyond that,
the other boxes are disabled, and the status line at the bottom of the menu says why.

Every box is kept at once, for this roundtable and the next ones: nothing to save. The first time,
the line says “Choose participants”, and ↩ opens the menu.

Hovering “3 participants” shows, for each agent, where the question goes, and what goes with it:
attached files, the last exchange of the conversation.

<a id="avis"></a>

## Follow the opinions

A “Roundtable” card shows under the question. Each participant has its row: its model and agent,
what it reads, for how long. Participants are read-only; the foot of the card says the level
(guaranteed, or only requested and checked on files tracked by git); a row whose level differs
carries a shield.

Once given, the opinion shows its short answer and its confidence. A click on a row unfolds it:
the whole opinion, or the detail of an error or a stop, and **Open its conversation**. A failed
participant says why and offers **Run again**; a refused model is said on its row (“model not
applied”) and flagged in the menu at the next roundtable.

If the folder changes during the roundtable, a single notice in the card says so, under the rows:
“The folder changed during the roundtable: <files>. Check before applying.” The row of the
participant that wrote, when known, carries “files changed”.

**Synthesize now** appears from two opinions: the participants still working stop. **Stop** stops
one participant, or the whole roundtable.

Stopping the whole roundtable waits for each participant to finish stopping: the card says
"stopping", then "stopped". A participant whose conversation reached its cost cap is "held by its
conversation cost cap": **Open its conversation** to choose **Continue**.

During the roundtable, the participants' conversations are in the sidebar, under yours; once it is
over, they leave it, and you find them from the card (**Open its conversation**) or the search. Moved
to the trash, a participant's conversation keeps its opinion readable on the card ("conversation in
the trash"); restored, its row is back as it was.

<a id="synthese"></a>

## Read the synthesis

When all have finished with at least two opinions, the conversation receives the opinions on its
own, without the model names (“Participant A, B, C”): it judges the arguments, not the brands. Its
answer carries a single label line, “Roundtable synthesis · <model> · N opinions”, and the card
folds into two lines: the header and **Used** (a click opens it again; rows are then sorted by
letter). Hovering or focusing “Participant C” shows the real name.

The synthesis and the decision are read-only: the conversation can neither write nor run a
command during those turns. If its agent goes ahead anyway, a warning shows under the label, with
the changed files. **Ask … to apply it** sends the conversation an ordinary message: the only time
files change.

The conversation’s model writes the synthesis: it cannot be a participant (it would judge its own
opinion). In the menu its box is disabled and says why; if you switch the conversation to a
participant’s model, the line says so, and the synthesis does not start until that is settled.
Each row of the card carries its letter, to make the link when the synthesis writes the letter
alone.

After Bobine restarts, nothing starts again on its own: the card offers **Synthesize with N
opinions** or **Run the stopped participant again** (**Run the N stopped participants again**).

<a id="replique"></a>

## Ask the participants to respond

**Ask participants to respond** sends the synthesis to each one, in its own conversation: it
maintains, nuances or rallies, saying why. The conversation then decides. One rebuttal per
roundtable.

<a id="cout"></a>

## What a roundtable costs

Much more than a plain question: each participant, then the synthesis. The line says so before
sending, with no estimate in money, and it is a minimum: a participant that explores the repository
with its tools costs more than a question, and the synthesis rereads the whole arbitrating
conversation (in a long conversation, hundreds of thousands of tokens). At the foot of the card, **Used** gives what the agents
reported, per unit, without conversion.

The per-conversation cost cap, when on, applies to each participant like to any conversation. A
participant that reaches it stops, and its row says so; the “Cap reached” card is in its
conversation (**Open its conversation**). If the arbitrating conversation reaches it, the
synthesis request is held: the “Cap reached” card shows in the thread, and **Continue** sends it.
