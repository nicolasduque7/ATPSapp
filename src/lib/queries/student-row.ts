import { parseDateOnly } from "@/lib/dates";
import type { Gender, Hand, Student, StudentLevel } from "@/lib/mock-data";

export const STUDENT_COLUMNS =
  "id, name, nickname, level, age, gender, hand, racket_type, since, coaching_note, email, auth_user_id, forehand_rating, backhand_rating, backhand_slice_rating, volley_rating, serve_rating, drop_shot_rating" as const;

export interface StudentRow {
  id: string;
  name: string;
  nickname: string | null;
  level: StudentLevel;
  age: number;
  gender: Gender;
  hand: Hand;
  racket_type: string | null;
  since: string;
  coaching_note: string | null;
  email: string | null;
  auth_user_id: string | null;
  forehand_rating: number;
  backhand_rating: number;
  backhand_slice_rating: number;
  volley_rating: number;
  serve_rating: number;
  drop_shot_rating: number;
}

export function mapStudentRow(row: StudentRow): Student {
  return {
    id: row.id,
    name: row.name,
    nickname: row.nickname ?? undefined,
    level: row.level,
    age: row.age,
    gender: row.gender,
    hand: row.hand,
    racketType: row.racket_type ?? undefined,
    since: parseDateOnly(row.since),
    coachingNote: row.coaching_note ?? undefined,
    email: row.email ?? undefined,
    linked: row.auth_user_id !== null,
    forehandRating: row.forehand_rating,
    backhandRating: row.backhand_rating,
    backhandSliceRating: row.backhand_slice_rating,
    volleyRating: row.volley_rating,
    serveRating: row.serve_rating,
    dropShotRating: row.drop_shot_rating,
  };
}
