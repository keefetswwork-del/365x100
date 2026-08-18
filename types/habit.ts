export interface WeeklyReviewSettings {
  enabled: boolean;
  day: number;
  time: string;
}
export interface HabitPreferences {
  dailyPromptsEnabled: boolean;
  onboardingCompleted: boolean;
  weeklyReview: WeeklyReviewSettings;
}

export interface CalendarDay {
  completed: boolean;
  entryDate: string;
  hasWriting: boolean;
  hasPhoto?: boolean;
  wordCount: number;
}

export interface HabitSummary {
  calendar: CalendarDay[];
  currentStreak: number;
  daysSinceLastWriting: number;
  firstEntryDate: string | null;
  lastSevenWritingDays: number;
  lastCompletedDate: string | null;
  lastWelcomeBackDate: string | null;
  longestStreak: number;
  missedDays: number;
  monthlyChapterDaysRemaining: number;
  monthlyChapterEligible: boolean;
  monthCompletedDays: number;
  monthElapsedDays: number;
  monthWritingDays: number;
  monthWords: number;
  mostRecentWritingDate: string | null;
  today: string;
  totalCompletedDays: number;
  totalWritingDays: number;
  totalWords: number;
  visibleMonth: string;
  yearCompletedDays: number;
  yearElapsedDays: number;
  yearWritingDays: number;
  yearWords: number;
}

export interface DailyPrompt {
  body: string;
  category: string;
  id: number;
}

export type ProductEventName =
  | "editor_started"
  | "twenty_five_words_reached"
  | "hundred_words_reached"
  | "signup_started"
  | "signup_completed"
  | "returned_next_day"
  | "seven_days_completed"
  | "writing_rhythm_viewed";

export type CalendarDayState =
  | "before-start"
  | "future"
  | "goal"
  | "open"
  | "written";

export interface CalendarGridDay {
  date: string;
  dayOfMonth: number;
  inVisibleMonth: boolean;
  isToday: boolean;
  hasPhoto?: boolean;
  state: CalendarDayState;
  wordCount: number;
}
