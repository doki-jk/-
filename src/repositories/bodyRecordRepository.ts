import { getDatabase } from '../database/client';

export interface BodyRecord {
  id: string;
  recordedDate: string;
  weight: number;
  bodyFat: number | null;
  muscleMass: number | null;
  waist: number | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BodyRecordInput {
  recordedDate: string;
  weight: number;
  bodyFat?: number | null;
  muscleMass?: number | null;
  waist?: number | null;
  note?: string | null;
}

function assertDate(value: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00`))) {
    throw new Error('记录日期格式必须为 YYYY-MM-DD');
  }
}

function validate(input: BodyRecordInput): void {
  assertDate(input.recordedDate);
  if (!Number.isFinite(input.weight) || input.weight <= 0) throw new Error('体重必须大于 0');
  if (input.bodyFat != null && (!Number.isFinite(input.bodyFat) || input.bodyFat < 0 || input.bodyFat > 100)) {
    throw new Error('体脂率必须在 0 到 100 之间');
  }
  for (const [label, value] of [['肌肉量', input.muscleMass], ['腰围', input.waist]] as const) {
    if (value != null && (!Number.isFinite(value) || value < 0)) throw new Error(`${label}不能为负数`);
  }
}

function mapRow(row: Record<string, unknown>): BodyRecord {
  return {
    id: String(row.id),
    recordedDate: String(row.recorded_date),
    weight: Number(row.weight),
    bodyFat: row.body_fat == null ? null : Number(row.body_fat),
    muscleMass: row.muscle_mass == null ? null : Number(row.muscle_mass),
    waist: row.waist == null ? null : Number(row.waist),
    note: row.note == null ? null : String(row.note),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export const bodyRecordRepository = {
  async getAll(): Promise<BodyRecord[]> {
    const db = await getDatabase();
    const rows = await db.select<Array<Record<string, unknown>>>(
      'SELECT * FROM body_records ORDER BY recorded_date DESC',
    );
    return rows.map(mapRow);
  },

  async save(input: BodyRecordInput): Promise<BodyRecord> {
    validate(input);
    const db = await getDatabase();
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    await db.execute(
      `INSERT INTO body_records(
        id, recorded_date, weight, body_fat, muscle_mass, waist, note, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(recorded_date) DO UPDATE SET
        weight = excluded.weight,
        body_fat = excluded.body_fat,
        muscle_mass = excluded.muscle_mass,
        waist = excluded.waist,
        note = excluded.note,
        updated_at = excluded.updated_at`,
      [
        id,
        input.recordedDate,
        input.weight,
        input.bodyFat ?? null,
        input.muscleMass ?? null,
        input.waist ?? null,
        input.note?.trim() || null,
        now,
        now,
      ],
    );
    const rows = await db.select<Array<Record<string, unknown>>>(
      'SELECT * FROM body_records WHERE recorded_date = ? LIMIT 1',
      [input.recordedDate],
    );
    if (!rows[0]) throw new Error('保存身体数据失败');
    return mapRow(rows[0]);
  },

  async remove(id: string): Promise<void> {
    const db = await getDatabase();
    await db.execute('DELETE FROM body_records WHERE id = ?', [id]);
  },
};
