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

Canonical implementation order

The build-numbered roadmap below is the implementation source of truth. Earlier phase descriptions remain as product history where they do not conflict with this order:

1. Build 1: Anonymous writing loop — delivered.
2. Build 2: Accounts and cloud persistence — delivered.
3. Build 3: Return habit — delivered.
4. Build 3.1: Rich writing and product story — delivered.
5. Build 3.2: History, search and export foundation — delivered.
6. Build 3.3: Writing-Year Foundations and Beta Operations — delivered.
7. Build 3.3.1: Life Story Without Streak Pressure — next.
8. Build 3.4: Monthly Chapters and Annual Digital Books — planned.
9. Build 4: Monetisation — planned.
10. Build 5: Printed-book validation — planned.
11. Build 6: Installable PWA — planned.
12. Build 7: Validate before expanding — ongoing measurement after release.

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

Status note: history, search and plain-text/data export were delivered by Build 3.2. Monthly chapters, annual-book preview and PDF generation are superseded by Build 3.4.

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
Supabase for authentication, storage, database functions and scheduled Edge Functions
Stripe Checkout later for payments
Resend for authentication delivery and optional weekly reviews
Render Static Site for the exported Next.js frontend
Playwright for unit, Edge Function and critical user-flow tests

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
Build 3.3.1 — Life Story Without Streak Pressure
Purpose

Reposition 365×100 from a strict daily journalling challenge into a forgiving life-preservation product.

The product should encourage regular writing without implying that missed days represent failure. The 100-word target remains a useful guide, while the primary value becomes preserving memories and gradually turning them into monthly chapters and personal books.

Core positioning

Primary promise

Preserve your life story, 100 words at a time.

Supporting message

Write about your days, memories and milestones whenever you want. 365×100 keeps everything organised and turns your writing into a personal book.

Product principles
Regular writing is encouraged, but perfect daily consistency is not required.
Every saved entry contributes to the user’s life story, regardless of length.
Missing a day must not reset progress or create a sense of failure.
The product celebrates memories preserved rather than days missed.
The 100-word target is a gentle goal, not a saving requirement.
Users retain access to and control over all their writing.
Chapter and book thresholds exist to ensure meaningful output, not to punish inconsistent users.
3.3.1 Scope
1. Entry completion
Allow users to save entries below 100 words.
Continue displaying the live word count.
Present 100 words as a gentle target.
Do not mark entries below 100 words as failed or incomplete.
Preserve existing rich-text, autosave and editing behaviour.
Entries of any non-zero length count as writing days.

Suggested interface language:

43 words preserved
Today’s gentle goal: 100 words
100 words captured today
Saved to your story
2. Replace streak pressure

Remove the consecutive-day streak as the dominant measure of progress.

Replace or supplement it with a Writing Rhythm view showing:

Writing days in the last seven days
Writing days during the current calendar month
Memories or entries preserved this month
Total words preserved
Most recent writing date

Suggested language:

You wrote on 4 of the last 7 days.
8 memories preserved this month.
Welcome back. Your story is still here.
Your August chapter is taking shape.

A current streak may remain as an optional secondary statistic, but it must not dominate the dashboard or trigger failure messaging when it ends.

3. Missed-day messaging

Replace guilt-oriented or loss-oriented messaging.

Do not use:

You lost your streak.
You missed yesterday.
Start over.
Incomplete day.
You are behind.

Use:

Welcome back.
What would you like to remember?
Your story is still here whenever you’re ready.
You can also write about an earlier day.
4. Backdated memories
Allow users to create an entry for a previous date.
Clearly show the selected entry date before saving.
Prevent accidental replacement when an entry already exists for that date.
Ask whether the user wants to edit the existing entry or cancel.
Assign backdated entries to the correct calendar month and personal writing year.
Ensure backdated entries update chapter eligibility and Writing Rhythm statistics.
5. Monthly Chapter eligibility

A calendar month becomes eligible for a Monthly Chapter after the user has written on at least 10 distinct days during that month.

Rules:

Entry length does not affect eligibility.
Multiple entries on the same date count as one writing day.
The month follows the user’s local timezone.
The chapter contains all entries from that calendar month.
Entries remain editable after chapter generation.
Editing or adding an entry allows the chapter to be regenerated.
Months with fewer than 10 writing days remain visible in the user’s history but are not proactively presented as completed chapters.
Users retain normal export access regardless of chapter eligibility.

Progress language:

7 of 10 writing days — 3 more to complete your September chapter.
Your September chapter is ready.
You preserved 14 days from September.

The interface must not suggest that the user failed if the threshold is not reached.

6. Personal Annual Book eligibility

The Personal Year remains a rolling 365-day period beginning on the user’s first saved entry.

At the end of that period:

Generate an Annual Book if the user has written on at least 60 distinct days.
Include every entry within the Personal Year.
Organise entries chronologically using calendar months as internal sections.
Permit partial first and final calendar-month sections.
Do not require 12 completed Monthly Chapters.
Monthly Chapter eligibility does not affect Annual Book inclusion.
Entries from months with fewer than 10 writing days are still included.
If the user has fewer than 60 writing days, do not proactively generate an Annual Book.
Users below the threshold retain access to all entries and normal exports.

Example:

Personal Year: 17 August 2026–16 August 2027
Sections: August 2026, September 2026 … August 2027
All entries within that 365-day period are included.

7. Annual participation milestones

Use milestones for encouragement without making them quality rankings:

30 writing days: Your story is taking shape.
60 writing days: Your year can become a book.
120 writing days: A substantial year in writing.
240 writing days: A richly documented year.
365 writing days: Every day preserved.

A meaningful year may contain fewer but more substantial entries. The 60-day threshold exists only to ensure the generated Annual Book contains enough material.

8. Terminology

Prefer:

Writing day
Memory
Entry
Writing Rhythm
Words preserved
Monthly Chapter
Personal Year
Annual Book

Avoid making these dominant:

Perfect streak
Failed day
Missed target
Incomplete entry
Broken streak
9. Analytics

Record only privacy-safe operational events. Never capture journal contents.

Suggested events:

short_entry_saved
entry_100_words_reached
backdated_entry_created
writing_rhythm_viewed
monthly_chapter_threshold_reached
annual_book_threshold_reached
welcome_back_message_shown

Measure:

Percentage of saved entries below 100 words
Writing days per user per month
Return rate after gaps of 3, 7 and 30 days
Percentage reaching 10 writing days in a month
Percentage reaching 30, 60 and 120 writing days in a Personal Year
Whether forgiving messaging improves user reactivation
Out of scope

Build 3.3.1 does not include:

Monthly Chapter layout or PDF generation
Annual Book layout or PDF generation
Printed books
Stripe subscriptions
Paywalls or 30-day history restrictions
Push notifications
AI rewriting, summarisation or analysis of private entries
Public or social journal sharing

Chapter and book generation remain part of Build 3.4.

Build 3.3.1 calculates and displays eligibility only. It does not generate, preview or export a Monthly Chapter or Annual Book. A Monthly Chapter qualifies at 10 visible-content writing days and is generated only after that calendar month ends in Build 3.4. An Annual Book qualifies at 60 visible-content writing days within a Personal Year and is generated only after Day 365 ends in Build 3.4.

Success conditions

Build 3.3.1 is complete when:

A user can save any non-empty entry below 100 words.
A sub-100-word entry is stored, synced, searchable, editable and exportable.
The interface describes 100 words as a target rather than a requirement.
No core screen describes a missed day or broken streak as failure.
Writing Rhythm correctly calculates distinct writing days for the previous seven days and current calendar month.
Users returning after a gap receive neutral or welcoming messaging.
A user can create an entry for an earlier date.
Existing-entry conflicts for backdated dates are handled without silent overwriting.
Backdated entries are assigned to the correct local calendar date and Personal Year.
Monthly Chapter eligibility activates at exactly 10 distinct writing days within a calendar month.
Nine writing days do not activate Monthly Chapter eligibility.
Multiple entries on the same date do not count as multiple writing days.
Annual Book eligibility activates at exactly 60 distinct writing days within the Personal Year.
Fifty-nine writing days do not activate Annual Book eligibility.
Monthly Chapter eligibility has no effect on Annual Book inclusion.
Entries from months below the monthly threshold remain included in the Annual Book.
Entries from partial first and final calendar months remain part of the relevant Personal Year.
Users can access and export their writing even when chapter or annual-book thresholds are not reached.
Existing entries, rich-text formatting, search, history and exports continue working.
Analytics record only operational metadata and never entry titles or contents.
Automated tests cover threshold boundaries, timezone boundaries, backdating and existing-entry conflicts.
Production testing confirms short-entry saving, backdating, cross-device restoration and threshold calculations.
Validation targets

These are product-validation targets, not release blockers:

At least 30% of activated users write on three or more days during their first week.
At least 20% write on 10 distinct days during their first 30 days.
At least 15% return after a gap of seven or more days.
At least 50% of returning users successfully save another entry.
Users understand that 100 words is encouraged but not mandatory.
Users do not interpret an unfinished Monthly Chapter as losing their writing.
Users understand that 60 writing days during their Personal Year unlock an Annual Book.

Build 3.3.2 — Private Media Uploads
Purpose

Allow users to attach one photograph to each journal entry, making their memories and future books more visually meaningful without turning 365×100 into a general photo-storage application.

Photographs supplement the user’s writing. Writing remains the primary content of every entry.

Product principles
Each entry may contain a maximum of one photograph.
Photographs are optional.
The photograph always appears above the written entry.
Uploading a photograph must never be required to save an entry.
Images must remain private and accessible only to their owner.
Images must be compressed before storage to control costs and loading time.
Images must not be sent to an AI provider during this build.
Removing a photograph must not remove or alter the written entry.
Users must retain access to existing photographs if their plan changes.
Free-plan limits restrict new uploads, not access to existing media.
3.3.2 Scope
1. Image attachment

Allow a signed-in user to attach one image to an entry.

Supported formats:

JPEG
JPG
PNG
WebP

Unsupported formats include:

HEIC
HEIF
GIF
SVG
BMP
TIFF
PDF
Video
Audio

Only one image may be attached to each entry.

Users can:

Add an image
Preview it before saving
Replace it
Remove it
Open it in a larger preview
Save an entry without an image
Add an image to an existing entry
Remove an image without affecting the entry text
2. File-size rules

The original selected file must not exceed 10 MB.

Before upload, the application must:

Validate the actual file type.
Reject files larger than 10 MB.
Correct image orientation where necessary.
Resize the image if required.
Strip unnecessary metadata, including location information.
Compress the processed image to 1 MB or smaller.
Preserve the original aspect ratio.
Upload only the processed version.

Recommended maximum image dimensions:

Maximum long edge: 2,500 pixels
Preserve aspect ratio
Never enlarge a smaller image

If an image cannot be reduced to 1 MB while maintaining an acceptable minimum quality, the upload must fail with a clear explanation. The application must not silently upload an oversized file.

PNG photographs may be converted to JPEG or WebP when necessary to reach the 1 MB limit. Transparency must be handled against a safe, consistent background if conversion removes it.

3. Image position

The photograph must appear only at the top of the entry.

Journal layout:

Entry date
Photograph
Written content
Entry metadata and controls

Book layout:

Entry date or heading
Photograph
Written entry

Users cannot:

Insert photographs between paragraphs
Drag photographs into the rich-text editor
Change the photograph’s position
Add multiple photographs
Add captions during this build
Crop or apply filters

The photograph’s placement must remain consistent across the editor, history, search results, previews and future digital books.

4. Free-plan allowance

Free users may store a maximum of 10 images across their account.

Rules:

Each attached image counts as one image.
The limit applies to currently stored images.
Replacing an image does not consume an additional slot after the replacement succeeds.
Deleting an image frees one slot.
Deleting an entry with an attached image frees one slot.
A failed upload does not consume a slot.
Images belonging to deleted entries must not continue counting towards the allowance.
Existing images remain viewable, downloadable and removable after the limit is reached.
Reaching the limit must not affect the ability to write, edit or save entries.

When a free user reaches 10 stored images, show:

You’ve used your 10 complimentary photo uploads. Upgrade to add photos to future entries.

Do not automatically delete, hide or reduce the quality of existing images.

5. Premium allowance

Premium users may attach one photograph to every entry, subject to reasonable fair-use and storage safeguards.

Premium users must still follow:

One image per entry
Maximum original upload size of 10 MB
Supported file-type restrictions
Compression to 1 MB or smaller

Until subscriptions are implemented, Premium entitlement should be controlled through the existing beta-access or entitlement system without exposing an incomplete payment flow.

6. Upload experience

The entry editor should include a compact media control:

Add a photo
JPEG, PNG or WebP · Maximum 10 MB

After selection, show:

Local preview
Processing status
Upload status
Replace action
Remove action
Clear error messaging

Suggested statuses:

Preparing photo…
Uploading photo…
Photo added
Photo upload failed
This file is larger than 10 MB.
Please choose a JPEG, PNG or WebP image.
We couldn’t compress this image. Please choose another photo.

The user must not need to reselect or rewrite their entry text if the image upload fails.

7. Saving behaviour

Text and media must be handled safely.

Required behaviour:

Entry text autosaves independently from the photograph.
A failed image upload must not discard text.
An interrupted upload must not create a broken attachment.
An image is associated with the entry only after upload completion.
Replacing an image must not delete the existing image until the replacement succeeds.
Removing an image must not remove the written entry.
Saving or editing text must not unnecessarily re-upload the photograph.
Duplicate clicks must not create duplicate stored objects.
Navigating away during an active upload must provide clear status or cancellation handling.
8. Storage architecture

Store media in a private Supabase Storage bucket.

Each media record should contain sufficient metadata to manage the file safely:

Media identifier
User identifier
Entry identifier
Private storage path
Processed MIME type
Processed file size
Width
Height
Created timestamp
Updated timestamp

Do not store permanent public URLs.

Access must use authenticated requests or short-lived signed URLs.

The storage path must be scoped to the owning user and use non-guessable identifiers.

Example:

journal-media/{user_id}/{entry_id}/{media_id}.webp
9. Security and privacy

Media uploads must follow the same privacy standard as journal entries.

Required controls:

Private storage bucket
User-specific access policies
Users can access only their own images
MIME type validated from file contents
File extensions cannot be trusted as validation
SVG and executable content rejected
Location and unnecessary EXIF metadata removed
Non-guessable storage paths
Short-lived signed URLs where required
No photograph included in operational analytics
No image contents, filenames or URLs recorded in analytics
No image sent to OpenAI or another AI provider
Account deletion removes all associated media
Entry deletion removes its associated media
Removed and replaced files are cleaned up safely

The Privacy Policy should be reviewed before public launch to confirm that uploaded media, storage, deletion and AI processing are accurately described.

10. Book compatibility

Build 3.3.2 does not generate Monthly Chapters or Annual Books, but uploaded images must be stored in a way that Build 3.4 can use.

Future book rules:

The image appears above its corresponding entry.
The image is included by default.
The image’s aspect ratio is preserved.
The image must not be stretched or distorted.
The book generator may scale the image to fit the page.
The image must remain associated with its original entry and date.
The image itself is not provided to AI unless a future opt-in feature explicitly permits it.

The AI editorial process should use the entry text. The deterministic book-layout system should insert the photograph afterward.

11. Deletion and cleanup

When a user removes an image:

Remove its association with the entry.
Remove its media record.
Delete the stored object.
Update the user’s current media count.

When an entry is deleted:

Delete its associated media record.
Delete its stored object.
Delete the entry.
Update the user’s media count.

When an account is deleted:

Remove every stored image owned by the user.
Remove all corresponding media records.
Confirm that no orphaned files remain.

A scheduled cleanup process should identify abandoned uploads and orphaned storage objects created by interrupted operations.

12. Analytics

Record only privacy-safe operational events.

Suggested events:

photo_selected
photo_processing_completed
photo_processing_failed
photo_upload_completed
photo_upload_failed
photo_replaced
photo_removed
free_photo_limit_reached

Permitted metadata:

Processed file-size range
Processed file type
Processing duration
Upload duration
Failure category
Free or Premium entitlement
Mobile or desktop device category

Never record:

Original filename
Storage path
Signed URL
Image contents
Entry contents
Extracted image metadata
People, objects or text detected within the photograph
Out of scope

Build 3.3.2 does not include:

More than one photograph per entry
Inline rich-text images
Photograph captions
Cropping
Filters
Rotation controls
Photo albums
Image search
Public sharing
Collaborative galleries
HEIC or HEIF support
GIF support
Videos
Audio recordings
Camera-roll integrations
Google Photos integration
Instagram integration
AI image analysis
AI-generated image descriptions
AI-generated photographs
Monthly Chapter generation
Annual Book generation
Printed-book ordering
Payments or subscription checkout
Success conditions

Build 3.3.2 is complete when:

A signed-in user can attach one image to a new entry.
A signed-in user can attach one image to an existing entry.
An entry cannot contain more than one image.
JPEG, JPG, PNG and WebP files are accepted.
Unsupported file types are rejected before upload.
Files larger than 10 MB are rejected.
Supported files are processed to 1 MB or smaller before storage.
Processed images retain the correct orientation.
Processed images preserve their aspect ratio.
Images are not enlarged unnecessarily.
Location and unnecessary EXIF metadata are removed.
The image appears above the written entry.
Image placement is consistent in the editor, calendar history and Journal Library.
A user can replace an attached image.
The original image remains available if its replacement fails.
A user can remove an image without deleting or altering the entry.
A failed image upload does not remove or overwrite journal text.
Interrupted or repeated upload attempts do not create duplicate attachments.
Free users can store up to exactly 10 images.
A free user with nine images can upload one additional image.
A free user with 10 images cannot upload an eleventh image.
Deleting an image frees one free-plan image slot.
Replacing an image does not permanently consume an additional slot.
Failed uploads do not consume free-plan image slots.
Reaching the free limit does not affect writing, editing or saving entries.
Existing images remain accessible after the free limit is reached.
Premium users can attach one image to every entry.
Images are stored in a private bucket.
Users cannot retrieve another user’s images.
Storage paths are not publicly enumerable.
Signed image access expires as configured.
Deleting an entry removes its associated stored image.
Deleting an account removes every image owned by that user.
Removed and replaced images do not remain as untracked storage objects.
Image contents, filenames and URLs do not appear in analytics.
Images are not sent to an AI provider.
Existing rich-text, autosave, search, export and entry-editing functionality continues working.
The media data structure is compatible with future Monthly Chapter and Annual Book rendering.
Automated tests cover file validation, size limits, compression, free-plan limits, replacement, deletion and authorisation.
Production testing confirms uploads on supported desktop and mobile browsers.
Validation metrics

These metrics evaluate whether photographs improve the product. They are not release blockers.

Adoption

Track:

Percentage of activated users who upload at least one image
Percentage of entries containing an image
Average number of stored images per active user
Percentage of free users who reach the 10-image limit
Percentage of Premium users who continue uploading images

Initial targets:

At least 20% of activated users upload one image within their first seven days.
At least 15% of saved entries contain an image.
At least 10% of active free users reach five stored images within 30 days.
Reliability

Track:

Image-processing success rate
Image-upload success rate
Median processing time
Median upload time
Failure rate by file type, file size and device category
Orphaned-file rate

Initial targets:

At least 98% upload success for valid supported files.
At least 99% processing success for valid supported files under 10 MB.
Median browser processing time below 3 seconds on supported devices.
Median upload time below 5 seconds on a normal mobile connection.
Fewer than 0.1% orphaned media records or stored objects.
Zero confirmed cross-user media-access incidents.
Product impact

Compare users who upload at least one image with users who do not.

Measure:

Day 2 return rate
Day 7 return rate
Writing days within the first 30 days
Monthly Chapter eligibility rate
Premium conversion
Printed-book interest

Initial directional targets:

Photo users show a higher Day 7 return rate than non-photo users.
Photo users record more writing days during their first 30 days.
At least 20% of users reaching the 10-image limit open the Premium offer.
At least 5% of users reaching the 10-image limit begin a Premium checkout once payments exist.
Chapter previews containing photographs receive stronger user-reported value than text-only previews.
Qualitative validation

During beta interviews or feedback collection, confirm whether users:

Understand that only one image is allowed per entry.
Understand that photographs appear at the top.
Find one image sufficient for preserving the day.
Trust that their photographs remain private.
Understand that images are not analysed by AI.
Consider photographs important to the value of their future book.
Want additional photographs strongly enough to justify expanding beyond one image per entry.

Do not expand to three images per entry unless repeated real-user feedback demonstrates that one photograph is materially insufficient.

# Addendum: Build 3.4 — Monthly Chapters and Annual Digital Books

## Purpose

Turn daily entries into the core 365x100 outcome: monthly chapters that help users revisit their writing and an annual digital book based on each user’s personal 365-day writing year.

Build 3.4 covers digital generation only. Printed-book ordering, payments, AI summaries and media uploads are excluded.

## 1. Monthly chapter system

- Treat each calendar month as a potential monthly chapter.
- Count distinct visible-content writing days within that calendar month.
- Require at least 10 writing days for a monthly chapter to be created.
- Entry length does not affect monthly eligibility; whitespace-only drafts do not count.
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
  - Number of writing days
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
- Require at least 60 visible-content writing days within the Personal Year.
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

- A calendar month with nine or fewer writing days does not produce a monthly chapter.
- A calendar month with at least 10 writing days produces a monthly chapter after the month ends.
- The eligibility counter includes every visible-content entry regardless of word count and excludes whitespace-only drafts.
- Monthly chapters contain the correct entries in chronological order.
- Months containing the beginning or end of a writing year are handled correctly.
- Users can see why an ineligible month did not generate a chapter.
- Editing a past entry correctly updates eligibility and regenerates the affected chapter.
- Monthly chapter formatting preserves dates, titles and supported rich text.
- An annual book becomes available only after the user’s personal Day 365 has ended.
- An annual book requires at least 60 writing days in that Personal Year; 59 writing days do not qualify.
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
