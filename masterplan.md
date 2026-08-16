365x100

Monetisation
A pure 100-word editor may be difficult to sell because users can use Notes for free. The monthly/annual-book outcome gives them something worth purchasing:
Free: write every day and access the most recent 30 days. Older entries remain safely stored but require Premium to access. Never silently delete someone’s journal.
Premium: S$29/year or S$5/month for complete history, reminders and exports
Annual digital book: included
Printed personal book: S$49

Build 365×100 as a mobile-first website and installable PWA. Native iOS and Android apps can come later if the product gains traction.

365×100 Product Plan

Promise: Write at least 100 words every day and preserve the story of your year.
Tagline: 365 days. 100 words a day. Your year in writing.

First-time user flow
The user should experience the product before being asked to register.
User visits 365x100.com.
Today’s writing page appears immediately.
The prompt says: “What happened today?”
User writes without creating an account.
Their draft is saved locally in the browser.
The counter progresses from 0 / 100.
At 100 words, show:
✓ Day 1 complete
Save your entry and begin your year.
User continues with Google or passwordless email.
The existing entry transfers into their account.
User selects a daily reminder time.
User enters the signed-in home screen.

First-time-flow success criteria
User can begin writing within five seconds.
Registration is not required before writing.
Draft survives an accidental refresh.
At least 60% of users who begin writing reach 100 words.
At least 50% of users who reach 100 words create an account.
User can complete the entire flow comfortably on mobile.

Signed-in user flow
User opens 365x100.com.
The app opens directly to today’s entry.
Existing text appears immediately if they previously started.
The user writes until reaching 100 words.
The entry saves automatically while they write.
At 100 words, the day is marked complete and the streak updates.
The user may stop or continue writing without a limit.
Secondary navigation provides access to:
Calendar
Previous entries
Search
Writing prompts
Export
Account and billing

Signed-in-flow success criteria
Today’s editor opens in two taps or fewer.
Previously written text never disappears.
Saving occurs automatically without a manual Save button.
Completion and streak status update correctly.
Users can continue beyond 100 words.
At least 40% of new users return the following day.
At least 20% complete seven separate writing days.

Development phases
Phase 1: Core writing experience
Build:
Mobile-first landing page
Daily writing editor
Live word counter
Local browser autosave
Optional writing prompt
100-word completion animation
Unlimited writing beyond 100 words
Basic product explanation and pricing page
Do not require an account yet.
Success criteria
A visitor can begin writing immediately.
Word counts remain accurate when text is pasted, deleted or edited.
Drafts survive refreshes and browser closures.
The interface works on mobile, tablet and desktop.
Ten test users can complete 100 words without instructions.
At least eight of those ten understand what the product does.

Phase 2: Accounts and cloud saving
Build:
Google authentication
Passwordless email authentication
Transfer anonymous draft into the new account
Cloud autosaving
One entry for each local calendar date
Timezone selection
Account deletion
Data-access security rules
Success criteria
Account creation takes less than one minute.
No written content is lost during registration.
A user can write on one device and continue on another.
Users cannot access another user’s entries.
Entries around midnight are assigned to the correct local date.
Failed saves are clearly shown and automatically retried.

Phase 3: Habit and retention
Build:
Current streak
Longest streak
Calendar of completed days
Daily email reminders
Reminder-time settings
Missed-day state
Optional daily prompts
Basic progress statistics
Success criteria
Streaks calculate correctly across timezones.
A completed day requires at least 100 words.
Reminder emails arrive at the user’s selected local time.
Users can disable reminders easily.
At least 40% of new users return for Day 2.
At least 20% complete seven writing days.
At least 10% complete 30 writing days.
Avoid harsh streak-loss messaging. Missing a day should not make the user feel that their entire year is ruined.

Phase 4: History and monthly/annual output
Build:
Previous-entry viewer
Search
Monthly and yearly views
Plain-text export
PDF export
Compiled “Your Year in Writing” document
Word totals and completed-day totals
The monthly/annual book should include everything the user wrote, not only the first 100 words from each day.
Success criteria
Users can find an old entry within 30 seconds.
Search returns accurate results.
Exports contain every selected entry in chronological order.
Formatting remains readable across mobile and desktop.
Users can download their data without contacting support.
Test users describe the monthly/annual book as something they would want to keep.

Phase 5: Payments
365×100 Membership — S$29/year
OR
5 SGD per month
Paid membership includes:
Full writing history
Search
Reminders
Exports
monthly/Annual digital book
Future prompts and themes
After seven completed days, introduce Premium and offer an upgrade. Users may continue on the free plan.
Success criteria
Users understand the price before checkout.
Checkout can be completed in under two minutes.
Successful payments activate access automatically.
Failed or cancelled payments do not delete entries.
Users can manage or cancel their membership themselves.
At least 5% of users who complete seven days become paying members.
The first ten customers pay without manual assistance.

Phase 6: Installable PWA
Build:
Home-screen installation
App icon and launch screen
Standalone mobile interface
Offline draft support
Synchronization after reconnecting
Push reminders where reliably supported
Email reminders should remain available because not every user will install the PWA or grant notification permission.
Success criteria
The product installs successfully on supported iPhones and Android devices.
It opens in a standalone app-like window.
Users can write while temporarily offline.
Offline entries synchronize without duplication.
Installation is offered only after the user has experienced the product.
At least 20% of active users install it.

Phase 7: Validate before expanding
Measure:
Visitors who begin writing
Users who reach 100 words
Users who create accounts
Day 2, Day 7 and Day 30 retention
Trial-to-paid conversion
Average completed days per user
Cancellation reasons
Export and monthly/annual-book usage
Success criteria
Before building native mobile apps, aim for:
100 paying members
At least 20% seven-day retention
At least 10% 30-day retention
At least 5% trial-to-paid conversion
Clear user complaints that native-app limitations are affecting usage
Until then, continue improving the website/PWA rather than splitting development across three applications.

Initial database structure
Table
Stores
profiles
User, timezone and reminder settings
entries
Date, content, word count and completion
streaks
Current and longest streak
subscriptions
Plan and payment status
prompts
Daily writing questions
reminders
Reminder time and delivery status

Recommended stack
Next.js with App Router
TypeScript
Tailwind CSS
Supabase later for authentication and storage
Stripe Checkout later for payments
Resend later for reminders
Vercel for deployment
Vitest for unit tests
Playwright for critical user-flow tests

Start with as few dependencies as possible.

Build 1: Anonymous writing loop

Build only this first:

/ opens directly to today’s editor
Current date
“What happened today?” prompt
Large writing area
Live 0 / 100 counter
Progress indicator
Browser autosave
Restoring after refresh
Completion state at 100 words
Writing beyond 100 words
Responsive mobile design

No navigation, accounts, database or pricing modal yet.

Screen states
State	Interface
Empty	Prompt, blank editor, 0 / 100
Writing	Progress indicator and autosave status
Completed	Checkmark, completion message and signup CTA
Returning	Previously written text restored automatically
Next day	A fresh entry associated with the new local date

At 100 words:

✓ Today is complete
Your first day is written. Save your entry and begin your year.

The signup button can initially be non-functional or open a simple “coming next” message while you test the writing experience.

Success criteria
User can begin typing within five seconds.
No registration is required.
Draft survives refresh and browser restart.
Pasting and deleting text updates the count correctly.
Reaching 100 words triggers completion only once.
Users can continue beyond 100 words.
A new local day produces a new entry.
Ten test users can use it without instructions.
No journal text is transmitted to analytics or error-reporting services.
Initial project structure
365x100/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── components/
│   ├── daily-editor.tsx
│   ├── word-progress.tsx
│   └── completion-card.tsx
├── lib/
│   ├── word-count.ts
│   ├── local-date.ts
│   └── local-entry.ts
├── types/
│   └── entry.ts
├── tests/
│   ├── word-count.test.ts
│   └── local-date.test.ts
└── product-plan.md
Define the core behaviour before coding
Local entry key

Use the user’s local date:

365x100:entry:2026-08-15

Do not use a UTC date. Someone writing at 12:30 a.m. in Singapore must have the entry assigned to the correct Singapore calendar day.

Autosave
Save locally after approximately 300 milliseconds without typing.
Show Saving… and then Saved.
Also save when the page becomes hidden.
Never require a Save button.
Word counting

Create one word-counting function and test it separately. It must handle:

Multiple spaces
New lines
Punctuation
Pasted text
Apostrophes
Hyphenated words
Emojis
Empty text

Decide whether the initial product is English-only. Multilingual word counting requires more careful segmentation.

Completion

A day is complete when the current entry contains at least 100 words. The celebration should appear only when crossing from fewer than 100 to 100 or more—not every time the component reloads.

Build 2: Accounts and cloud persistence

Once anonymous writing works, add:

Google authentication
Passwordless email
Supabase database
Transfer of the anonymous entry after signup
Cross-device synchronization
Save-error handling
Row-level access controls
Account deletion

The critical path is:

Success criteria
Registration never clears the editor.
The anonymous entry appears after signup.
The same entry is available on another device.
One user cannot access another user’s writing.
Temporary connection failure does not overwrite newer content.
Build 3: Return habit

Add:

Today’s signed-in editor
Calendar
Current and longest streak
Previous entries
Email reminder settings
Optional prompts
Basic product analytics

Track events such as:

editor_started
twenty_five_words_reached
hundred_words_reached
signup_started
signup_completed
returned_next_day
seven_days_completed

Never include entry content in analytics properties. Disable or fully mask session recording on the editor.

Success criteria
60% of people who begin writing reach 100 words.
50% of completers create an account.
40% of registered users return the next day.
20% complete seven separate days.
Build 4: Monetisation

Only after people return:

Free users access their latest 30 days.
Older writing remains securely stored but locked.
Premium costs S$5/month or S$39/year.
Upgrade prompt appears after seven completed days.
Stripe Checkout handles payment.
Cancellation does not delete writing.
Users can export before deleting their accounts.

Annual should be the visibly recommended option:

S$29/year — Save 50%

Success criteria
First ten payments require no manual assistance.
At least 5% of seven-day users upgrade.
Users understand what becomes locked without Premium.
Failed payments never cause data loss.
Build 5: Annual book

After proving retention and payment:

Chronological entry compilation
Cover page
Monthly sections
Word and day totals
PDF generation
Digital-book download
Printed-book preorder test

Do not build printing logistics yet. First place a “Get this printed — S$49” interest button and measure demand.

