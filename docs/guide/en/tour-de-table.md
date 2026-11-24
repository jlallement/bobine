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
then write the question. The question gets the “Roundtable” tag, and a grey line shows below it:
“3 participants ▾ + synthesis · ≈ 4× the tokens of a plain question”. ↩ sends.

Escape, the cross of the line, or ⌫ at the start of the question take you back to a plain question.

A roundtable does not start from a delegated task, nor in the Chat space. One roundtable at a time
per conversation: a second one is refused until the first has given its synthesis. A question of
more than 8,000 characters is refused too: attach the details as a file.

<a id="participants"></a>

## Choose the participants

“3 participants ▾” opens a checkbox menu: recently used models first, then **Other models…** to
search the whole list. An agent that does not let you choose its model (IBM Bob) takes a single
line. Two to five participants; beyond that, the other boxes are disabled.

Every box is kept at once, for this roundtable and the next ones: nothing to save. The first time,
the line says “Choose participants”, and ↩ opens the menu.

Hovering “3 participants” shows where each question goes and what goes with it: attached files,
the last exchange of the conversation.

<a id="avis"></a>

## Follow the opinions

A “Roundtable” card shows under the question. Each participant has its row: its model and agent,
what it reads, for how long. Participants are read-only: a shield reminds you, full when it is
guaranteed, marked when it is only requested (an agent that writes without asking). “Requested”
read-only is only checked in the git repository: Bobine compares the repository before and after,
and if a participant changes it anyway, its row says so. Outside a git repository it is not
checked at all, and the row says so too.

Once given, the opinion shows its short answer and its confidence; a click unfolds it in full,
with **Open its conversation**. A failed participant says why and offers **Run again**; a refused
model offers **Choose another model**, for the next roundtables.

**Synthesize now** appears from two opinions: the participants still working stop. **Stop** stops
one participant, or the whole roundtable.

<a id="synthese"></a>

## Read the synthesis

When all have finished with at least two opinions, the conversation receives the opinions on its
own, without the model names (“Participant A, B, C”): it judges the arguments, not the brands. Its
answer is labelled “Roundtable synthesis”, and the card folds into one line (a click opens it
again). Hovering or focusing “Participant C” shows the real name.

**Ask … to apply it** sends the conversation an ordinary message: the only time files may change.

After Bobine restarts, nothing starts again on its own: the card offers **Synthesize with N
opinions** or **Resume**.

<a id="replique"></a>

## Ask the participants to respond

**Ask participants to respond** sends the synthesis to each one, in its own conversation: it
maintains, nuances or rallies, saying why. The conversation then decides. One rebuttal per
roundtable.

<a id="cout"></a>

## What a roundtable costs

Much more than a plain question: each participant, then the synthesis. The line says so before
sending, with no estimate in money. At the foot of the card, **Used** gives what the agents
reported, per unit, without conversion.

The per-conversation cost cap, when on, applies to each participant like to any conversation. A
participant that reaches it stops, and its row says so; the “Cap reached” card is in its
conversation (**Open its conversation**). If the arbitrating conversation reaches it, the
synthesis request is held: the “Cap reached” card shows in the thread, and **Continue** sends it.
