import { FOOD_CATALOG } from '../data/foodCatalog';
import { getDatabase } from './client';

export async function seedDatabase(): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.execute('BEGIN IMMEDIATE');
  try {
    for (const food of FOOD_CATALOG) {
      await db.execute(
        `INSERT INTO foods(
          id,name,category,base_amount,base_unit,calories,protein,carbs,fat,
          is_favorite,is_custom,usage_count,created_at,updated_at
        ) VALUES (?,?,?,?,?,?,?,?,?,0,0,0,?,?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          category = excluded.category,
          base_amount = excluded.base_amount,
          base_unit = excluded.base_unit,
          calories = excluded.calories,
          protein = excluded.protein,
          carbs = excluded.carbs,
          fat = excluded.fat,
          updated_at = excluded.updated_at
        WHERE foods.is_custom = 0`,
        [
          food.id,
          food.name,
          food.category,
          food.baseAmount,
          food.baseUnit,
          food.calories,
          food.protein,
          food.carbs,
          food.fat,
          now,
          now,
        ],
      );
    }
    await db.execute('COMMIT');
  } catch (error) {
    await db.execute('ROLLBACK');
    throw error;
  }
}
