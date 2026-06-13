import type { PresetName } from "../runtime";

export interface PresetCatalogEntry {
  id: PresetName;
  title: string;
  description: string;
  mood: string;
}

export const PRESET_CATALOG: PresetCatalogEntry[] = [
  {
    id: "Curious",
    title: "きょろきょろ・興味あり",
    description: "周りに興味を示し、体を少し傾けて見回す動きです。",
    mood: "探索・配信の雑談向き",
  },
  {
    id: "Happy",
    title: "明るい・笑顔寄り",
    description: "元気で口元が明るく、表情が活発になります。",
    mood: "楽しい雰囲気・挨拶向き",
  },
  {
    id: "Idle",
    title: "ゆったり待機",
    description: "落ち着いた待機モーション。控えめな動きです。",
    mood: "待機画面・少人数配信向き",
  },
  {
    id: "Thinking",
    title: "考え中",
    description: "考え込むような視線と姿勢の動きです。",
    mood: "解説・相談シーン向き",
  },
  {
    id: "Sleepy",
    title: "眠そう・だるい",
    description: "ゆるく、眠たげな動き。テンポがゆっくりです。",
    mood: "夜枠・まったり配信向き",
  },
  {
    id: "Focused",
    title: "集中・真剣",
    description: "視線と姿勢が引き締まった、集中した動きです。",
    mood: "ゲーム実況・作業配信向き",
  },
];
