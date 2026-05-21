// Core types for the AI YouTube Command Center

export interface Video {
  youtube_id: string;
  title: string;
  description: string;
  thumbnail_url: string;
  published_at: string;
  duration_seconds: number;
  tags: string[];
  views: number;
  likes: number;
  comments: number;
}

export interface VideoAnalytics {
  youtube_id: string;
  views: number;
  likes: number;
  comments: number;
  ctr: number;
  avg_view_percentage: number;
  avg_view_duration_seconds: number;
  impressions: number;
  watch_time_minutes: number;
  revenue_usd: number;
}

export interface AIInsight {
  main_reason: string;
  thumbnail_analysis: string;
  title_analysis: string;
  retention_analysis: string;
  seo_analysis: string;
  improved_title: string;
  next_video_advice: string;
}

export interface PerformanceIssue {
  issue: string;
  severity: "critical" | "warning" | "minor";
  fix: string;
}
