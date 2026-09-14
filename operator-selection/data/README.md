# Operator selection data

This directory is reserved for structured data used by the new tab, including
operator metadata, weapon tokens, health and breach values, team selections,
and the Ban & Pick action sequence.

`operators.csv` uses the `side` field to identify each roster entry as
`attack` or `defense`. Alternate entries inherit the side of their base
operator; recruit entries derive it from their `recruit_attack_*` or
`recruit_defense_*` identifier.
