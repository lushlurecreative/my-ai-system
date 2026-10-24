# Protected files (fill in per project)

Claude may never edit, overwrite, move or delete these, by any route (editor, shell, git, connector). Hooks deny it. To unlock one file for one session, Shaun creates `.claude/override.txt` containing `allow: <path>`. Folders work as globs (for example `supabase/migrations/**`). While this list is still the template, the project's chat proposes the list and `scripts/set-protected.sh` fills it once.

## Protected files
- `(path/to/payments-or-checkout-code)`
- `(path/to/core-business-logic)`
- `(path/to/pricing-or-tier-limits)`

## Protected database functions (never edited in place; migrations that mention them are blocked)
- `(function_name)`

## Protected words (a request to a connector such as Lovable that mentions these is blocked)
- `(checkout)`
- `(payments)`
