export type NavAttentionEntry = {
  count: number;
  label: string;
};

export type NavAttentionCounts = Record<string, NavAttentionEntry>;

export type NavAttentionPayload = {
  counts: NavAttentionCounts;
  generatedAt: string;
};
