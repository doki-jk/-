import { readBrowserData, writeBrowserData } from '../database/browserStorage';
import { getDatabase, isTauriRuntime } from '../database/client';
import type { GoalProfile } from '../utils/goalCalculator';

interface ProfileRow {
  sex: GoalProfile['sex'];
  age: number;
  height_cm: number;
  weight_kg: number;
  activity_level: GoalProfile['activityLevel'];
  objective: GoalProfile['objective'];
}

export const defaultGoalProfile: GoalProfile = {
  sex: 'male',
  age: 21,
  heightCm: 175,
  weightKg: 70,
  activityLevel: 'moderate',
  objective: 'maintain',
};

function mapRow(row: ProfileRow): GoalProfile {
  return {
    sex: row.sex,
    age: row.age,
    heightCm: row.height_cm,
    weightKg: row.weight_kg,
    activityLevel: row.activity_level,
    objective: row.objective,
  };
}

export const userProfileRepository = {
  async get(): Promise<GoalProfile> {
    if (!isTauriRuntime()) return readBrowserData<GoalProfile>('goal-profile', defaultGoalProfile);
    const db = await getDatabase();
    const rows = await db.select<ProfileRow[]>('SELECT sex, age, height_cm, weight_kg, activity_level, objective FROM user_profile WHERE id = 1');
    return rows[0] ? mapRow(rows[0]) : defaultGoalProfile;
  },

  async save(profile: GoalProfile): Promise<void> {
    if (!isTauriRuntime()) {
      writeBrowserData('goal-profile', profile);
      return;
    }
    const db = await getDatabase();
    await db.execute(
      `INSERT INTO user_profile(id,sex,age,height_cm,weight_kg,activity_level,objective,updated_at)
       VALUES (1,?,?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET
         sex=excluded.sex,
         age=excluded.age,
         height_cm=excluded.height_cm,
         weight_kg=excluded.weight_kg,
         activity_level=excluded.activity_level,
         objective=excluded.objective,
         updated_at=excluded.updated_at`,
      [profile.sex, profile.age, profile.heightCm, profile.weightKg, profile.activityLevel, profile.objective, new Date().toISOString()],
    );
  },
};
