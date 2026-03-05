Most important: the V2 rewrite should barekey to bootstrap itself

Structure:

-- language undecided? (Ocaml, Haskell, Rust, Kotlin even???)
pkg/auth -> standalone auth server (replaces full Clerk dep and the react/vite spa only serving spa otp code UI)
pkg/api -> standalone server responsible for all requests other than auth (replaces convex dep)

-- stack undecided? (Tanstack start or sveltekit)
pkg/dashboard -> application (replacing react/vite spa)
pkg/docs -> static docs (replacing mintlify)
pkg/landing -> static pages like / or /pricing and similiar.

pkg/cli -> our cli allowing full progamatic and agentic use for every single feature in the dashboard (Rust cli(Clap?))
pkg/sdk
-- add docs or a universal sdk for community adapters
typescript
rust

OTP rewrite:
Rewrite the 8 ciphered otp to a 9 lettered displayed as 3x3 grid with this letterset:
⊕ ⊗ ▲ ◆ ★ ✚ ◉ ◎ ⌘ ☉
