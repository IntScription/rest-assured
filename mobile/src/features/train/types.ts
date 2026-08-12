export type Program = {
  id: string;
  name: string;
  is_active: boolean | null;
  user_id: string;
  created_at: string | null;
  schedule_anchor_date?: string | null;
};

export type Split = {
  id: string;
  name: string;
  program_id: string;
  order_index: number;
  user_id?: string;
  focus?: string | null;
  is_rest_day?: boolean | null;
  rest_activity_label?: string | null;
};

export type ThemeType = {
  background: string;
  card: string;
  cardAlt: string;
  text: string;
  mutedText: string;
  border: string;
  inputBg: string;
  inputBorder: string;
  link: string;
  danger?: string;
  success?: string;
};
