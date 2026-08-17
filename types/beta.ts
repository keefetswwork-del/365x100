export type WritingYearSummary =
  | {
      hasWritingYear: false;
      today: string;
    }
  | {
      completedDays: number;
      dayNumber: number;
      endDate: string;
      hasWritingYear: true;
      startDate: string;
      today: string;
      totalEntries: number;
      totalWords: number;
      yearNumber: number;
    };

export interface LegalAcceptanceStatus {
  accepted: boolean;
  authenticated: boolean;
  privacyVersion: string | null;
  termsVersion: string | null;
}

export type OperationalFeatureArea =
  | "auth"
  | "entry-load"
  | "entry-save"
  | "export"
  | "migration"
  | "profile"
  | "writing-year";

export type OperationalErrorCode =
  | "auth-callback-failed"
  | "entry-load-failed"
  | "export-failed"
  | "migration-failed"
  | "otp-send-failed"
  | "otp-verify-failed"
  | "profile-load-failed"
  | "save-retry-exhausted"
  | "session-expired"
  | "writing-year-load-failed";
