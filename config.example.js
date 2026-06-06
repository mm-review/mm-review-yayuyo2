// ============================================================
//  Supabase 接続設定 — このファイルをコピーして config.js にリネームし、
//  実際の値を入力してください。config.js は .gitignore で除外されています。
// ============================================================
const SUPABASE_URL  = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_ANON = 'YOUR_ANON_KEY';

// ============================================================
//  スコア項目定義（追加・削除・並び替え自由）
// ============================================================
const CATEGORIES = [
  { key: 'suiri',     label: '推理' },
  { key: 'roleplay',  label: 'ロールプレイの楽しさ' },
  { key: 'design',    label: 'デザイン' },
  { key: 'gimmick',   label: 'ギミック' },
  { key: 'character', label: 'キャラクター' },
];
