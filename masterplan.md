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
User selects a weekly review time.
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
Weekly stat review email
Reminder-time settings with monthly book + yearly book completion
Missed-day state (3 days, 1 week, welcome back)
Refresh daily prompts (Toggle if user wants a new prompt daily or not. build database 150 prompts relevant to the 100 words and users life in order to get a good monthly or annual book
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
Premium costs S$5/month or S$29/year.
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

Build 3.1 addendum: Rich writing and product story

Build 3.1 is implemented after Build 3: Return habit and before Build 4: Monetisation, even though this addendum appears at the end of the roadmap.

Add:

A distraction-free rich-text editor for anonymous and signed-in writers
Undo and redo
Paragraph, title, subtitle and quote styles
Bold, italic, underline and strikethrough
Bullet and numbered lists
Indentation and text alignment
Safe links
Emoji search and insertion
Curated Newsreader and Manrope typography
Curated font sizes, text colours and highlights
Clear formatting
An “About 365x100” explanation that never blocks writing
A post-completion message connecting today’s writing to the user’s life story
A signed-in “Your book in progress” panel using month and year statistics

Keep plain text as the authoritative projection for word counts, progress, analytics privacy and future book generation. Store a versioned rich document beside it so formatting survives refresh, signup, cloud sync, offline retry, past-entry editing and version conflicts. Existing plain-text entries must continue to open safely, and cached older clients must retain their original save path.

Explain that writing 100 words a day creates a record of a life that can become monthly chapters and an annual collection. Monthly and annual digital books and optional hardcopy are a coming-later vision, not an available product in Build 3.1.

Do not add:

Images or file uploads
Tables, drawings or checklists
Arbitrary fonts, colours or CSS
PDF or book generation
Digital-book downloads
Payments, print orders or preorder handling

Never include plain or formatted journal content in analytics, URLs, logs, telemetry or error messages.

Success criteria

Formatting survives refresh, anonymous-to-account migration and cross-device sync.
Formatting a passage never changes its word count or completion state.
Existing plain-text entries and cached Build 3 clients continue to save safely.
Mobile controls do not obstruct the editor or keyboard.
All toolbar controls are keyboard accessible, labelled and visibly focused.
The product story is discoverable without replacing the direct-to-editor homepage.
Future book language is clearly labelled as coming later.

Build 3.2 addendum: History, search and export foundation

Build 3.2 is implemented after Build 3.1: Rich writing and product story and before Build 4: Monetisation, even though this addendum appears at the end of the roadmap.

Add:

A single signed-in Journal Library that extends the existing Progress and Calendar dashboard
Complete chronological history browsing without duplicating the calendar or past-entry editor
Private, case-insensitive and language-neutral search across authoritative plain-text entries
Optional date filters and paginated history results
Safe excerpts, word counts and completed or started states in history results
Opening any calendar or history result in the existing rich editor
Selection of individual entries for chronological plain-text export
Plain-text export of every entry
A portable JSON data download containing profile preferences, plain and rich entries and prompt assignments

Keep existing rich-entry persistence, optimistic conflict handling, RLS ownership, local caches and offline safeguards. Search terms and journal content must never appear in URLs, analytics, logs, telemetry or error messages. Complete search and export require connectivity so the interface never represents a partial offline result as complete.

Do not add:

Payment gates or a 30-day history restriction
PDF or generated-book output
Printing or preorder handling
Entry sharing or public links
Third-party search or analytics services
Another history page, Render service or deployment environment

Success criteria

A user can find and open an old entry within 30 seconds.
Search returns accurate owned results without exposing another user's writing.
Every selected entry appears once in chronological export order.
The complete data download includes every owned entry and the user's preferences.
Pending edits are included before export or export is safely blocked.
Mobile and desktop library navigation remain accessible and do not duplicate Calendar.

---

# Addendum: Build 3.3 — Writing-Year Foundations and Beta Operations

## Purpose

Make daily writing dependable, establish each user’s personal 365-day writing year, and provide the controls needed to operate the private beta safely.

This build does not add daily reminder emails. Weekly writing reviews remain optional.

## 1. Daily-entry reliability

- Show a clear saving state:
  - Saving…
  - Saved
  - Save failed
- Autosave drafts while the user writes.
- Recover unsaved local drafts after refresh, browser closure or temporary connection loss.
- Maintain one entry per user’s local calendar day.
- Use the user’s saved timezone to determine the current writing date.
- Handle midnight and timezone changes without duplicating, overwriting or assigning entries to the wrong day.
- Mark a day as completed once the entry reaches at least 100 words.
- Allow users to continue writing beyond 100 words.
- Allow previous entries to be edited.
- Recalculate completion status when an existing entry is edited.
- Preserve rich-text formatting during saves, synchronisation and later editing.
- Reconcile local and cloud changes safely after a user reconnects.
- Provide working authentication recovery and passwordless sign-in flows.

## 2. Personal writing-year system

- Create the user’s first writing year when their first authenticated entry is saved.
- Set the first saved entry’s local date as Day 1.
- Set Day 365 to 364 calendar days after Day 1.
- Store writing-year boundaries independently from streaks and completed-entry counts.
- Do not move the writing-year dates when the user misses a day.
- Display the user’s current progress as:
  - Day X of 365
  - Number of completed writing days
  - Writing-year start and end dates
- Assign every entry to the correct writing year.
- Allow the first writing year to contain fewer than 365 completed entries.
- Begin a new writing year automatically after the previous 365-day period ends.
- Preserve previous writing years for later viewing and book generation.

## 3. Private-beta controls

- Display a discreet Private Beta label.
- Publish links to the Privacy Policy and Terms of Use.
- Record acceptance of the current Privacy Policy and Terms versions during registration.
- Provide an accessible feedback and bug-reporting method.
- Protect administrative functions from ordinary users.
- Provide an internal admin view showing only the information required to operate the beta, including:
  - User count
  - Account creation date
  - Last active date
  - Completed-entry count
  - Current writing-year progress
  - Relevant system errors
- Do not expose journal contents in aggregate analytics or ordinary admin reporting.
- Keep user data export and account deletion available.
- Provide privacy-respecting product events for:
  - Entry started
  - Entry completed
  - Account created
  - Returning writer
  - Monthly chapter eligibility
- Add basic rate limiting, error monitoring and database backup procedures.

## Build 3.3 success conditions

Build 3.3 is complete when:

- A user can write, refresh the page and recover their latest draft without losing content.
- The interface accurately reports whether an entry is saving, saved or failed.
- A temporary connection loss does not silently overwrite a newer local or cloud entry.
- Rich text survives saving, signing out, signing in and opening the entry on another device.
- Each user can have only one entry for a given local calendar date.
- Entries created around midnight are assigned to the correct date in the user’s timezone.
- Reaching 100 words marks the day as completed.
- Editing an entry below 100 words recalculates its completion status consistently.
- The first authenticated entry permanently establishes Day 1 of the user’s writing year.
- Missing days do not postpone the writing-year end date.
- Day X of 365 is calculated correctly throughout the writing year.
- Entries are assigned to the correct writing year at its start and end boundaries.
- A second writing year begins correctly after Day 365.
- Privacy Policy and Terms links are visible and acceptance is recorded.
- A beta user can submit feedback, export their data and delete their account.
- Ordinary users cannot access beta-administration functions.
- Product analytics contain event metadata but never journal text.
- The complete automated test suite and production smoke test pass.

---

# Addendum: Build 3.4 — Monthly Chapters and Annual Digital Books

## Purpose

Turn daily entries into the core 365x100 outcome: monthly chapters that help users revisit their writing and an annual digital book based on each user’s personal 365-day writing year.

Build 3.4 covers digital generation only. Printed-book ordering, payments, AI summaries and media uploads are excluded.

## 1. Monthly chapter system

- Treat each calendar month as a potential monthly chapter.
- Count completed daily entries within that calendar month.
- Require at least 10 completed daily entries for a monthly chapter to be created.
- Do not count entries below 100 words toward monthly eligibility.
- Show progress toward eligibility during the month, such as:
  - 7 of 10 completed days
  - 3 more completed days needed
- Evaluate eligibility after the calendar month ends.
- Compile eligible entries in chronological order.
- Include:
  - Month and year
  - Entry date
  - Entry title, when available
  - Rich-text entry content
  - Number of completed writing days
- Provide an in-app monthly chapter view.
- Allow eligible monthly chapters to be exported in a portable digital format.
- Clearly explain why a chapter was not created when the user completed fewer than 10 days.
- Recalculate chapter eligibility when a past entry is edited.
- Regenerate an existing chapter when its source entries change.
- Keep monthly chapters aligned to calendar months even when a writing year begins partway through a month.
- Assign each chapter or relevant portion to the correct personal writing year.

## 2. Annual digital-book system

- Make each annual book cover exactly one personal writing year:
  - Day 1 is the date of the user’s first saved authenticated entry for that writing year.
  - Day 365 is 364 calendar days later.
- Generate the annual book only after Day 365 has ended.
- Compile entries chronologically within the writing-year boundaries.
- Organise the book into calendar-month sections.
- Handle partial first and final calendar months correctly.
- Include:
  - A cover page
  - Writing-year date range
  - Table of contents
  - Monthly sections
  - Entry dates
  - Entry titles, when available
  - Rich-text entry content
  - End-of-year writing statistics
- Preserve the user’s writing rather than rewriting or summarising it.
- Do not use AI-generated summaries in this build.
- Represent missed days through writing statistics or date gaps rather than blank pages.
- Provide an in-app book preview.
- Allow the annual book to be exported as a readable PDF.
- Regenerate the book when an included entry is edited.
- Preserve completed annual books and allow users to revisit previous writing years.
- Keep book generation separate from future printed-book purchasing.

## Build 3.4 success conditions

Build 3.4 is complete when:

- A calendar month with nine or fewer completed entries does not produce a monthly chapter.
- A calendar month with at least 10 completed entries produces a monthly chapter after the month ends.
- The eligibility counter includes only entries containing at least 100 words.
- Monthly chapters contain the correct entries in chronological order.
- Months containing the beginning or end of a writing year are handled correctly.
- Users can see why an ineligible month did not generate a chapter.
- Editing a past entry correctly updates eligibility and regenerates the affected chapter.
- Monthly chapter formatting preserves dates, titles and supported rich text.
- An annual book becomes available only after the user’s personal Day 365 has ended.
- The annual book contains only entries within the correct 365-day writing year.
- Partial first and final months appear correctly.
- Missed days do not create unnecessary blank pages.
- The preview and exported PDF contain the same entries in the same order.
- Long entries, page breaks and rich-text formatting render correctly in the PDF.
- Editing an included entry causes the annual book to regenerate correctly.
- Previous annual books remain accessible after a new writing year begins.
- No private journal content is exposed to another user during chapter or book generation.
- Monthly chapter and annual-book generation pass automated tests and production acceptance testing.

## Explicitly excluded from Builds 3.3 and 3.4

- Daily reminder emails
- Paid subscriptions and Stripe
- Premium history restrictions
- Printed-book ordering
- AI-written summaries
- Photo, audio or video uploads
- Social sharing of private journal content