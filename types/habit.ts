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
  wordCount: number;
}

export interface HabitSummary {
  calendar: CalendarDay[];
  currentStreak: number;
  firstEntryDate: string | null;
  lastCompletedDate: string | null;
  lastWelcomeBackDate: string | null;
  longestStreak: number;
  missedDays: number;
  monthCompletedDays: number;
  monthElapsedDays: number;
  monthWords: number;
  today: string;
  totalCompletedDays: number;
  totalWords: number;
  visibleMonth: string;
  yearCompletedDays: number;
  yearElapsedDays: number;
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
  | "seven_days_completed";

export type CalendarDayState =
  | "before-start"
  | "complete"
  | "empty"
  | "future"
  | "missed"
  | "started";

export interface CalendarGridDay {
  date: string;
  dayOfMonth: number;
  inVisibleMonth: boolean;
  isToday: boolean;
  state: CalendarDayState;
  wordCount: number;
}
