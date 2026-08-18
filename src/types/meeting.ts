export interface MeetingMinute {
  id: string;
  date: string;
  title: string;
  club?: string;
  attendees: string[];
  summary: string;
  decisions: string[];
  issues: string[];
  bottlenecks: string[];
  unresolvedItems: string[];
  tags: string[];
  authorId: string;
  authorName: string;
  createdAt: string;
}

export interface RecurringIssue {
  issue: string;
  frequency: number;
  meetings: string[];
  suggestion: string;
  severity: 'high' | 'medium' | 'low';
}

export interface MeetingInsight {
  id: string;
  meetingId: string;
  analyzedAt: string;
  recurringIssues: RecurringIssue[];
  undecidedMatters: {
    matter: string;
    raisedDate: string;
    status: 'pending' | 'stalled' | 'needs_discussion';
    suggestion: string;
  }[];
  bottlenecks: {
    pattern: string;
    impact: 'high' | 'medium' | 'low';
    affectedAreas: string[];
    suggestion: string;
  }[];
  aiSummary: string;
}