import { getDatabase } from './client';

const seedFoods = [
  ['seed-chicken-breast','鸡胸肉','蛋白质来源',100,'g',165,31,0,3.6],
  ['seed-egg','鸡蛋', '蛋白质来源',1,'个',70,6.3,0.6,4.8],
  ['seed-beef','瘦牛肉','蛋白质来源',100,'g',250,26,0,15],
  ['seed-rice','熟米饭','主食',100,'g',116,2.6,25.9,0.3],
  ['seed-oats','燕麦片','主食',100,'g',380,13,68,7],
  ['seed-banana','香蕉','水果',1,'根',105,1.3,27,0.4],
  ['seed-milk','脱脂牛奶','乳制品',100,'ml',35,3.4,5,0.2],
  ['seed-yogurt','无糖希腊酸奶','乳制品',100,'g',73,9,4,2.2],
  ['seed-broccoli','西兰花','蔬菜',100,'g',34,2.8,6.6,0.4],
  ['seed-almonds','杏仁','坚果',30,'g',174,6.4,6.5,15],
  ['seed-whey','乳清蛋白粉','补剂',30,'g',120,24,3,2],
  ['seed-sweet-potato','红薯','主食',100,'g',86,1.6,20.1,0.1]
] as const;

export async function seedDatabase(): Promise<void> {
  const db = await getDatabase();
  const rows = await db.select<Array<{ count: number }>>('SELECT COUNT(*) AS count FROM foods');
  if ((rows[0]?.count ?? 0) > 0) return;

  const now = new Date().toISOString();
  await db.execute('BEGIN IMMEDIATE');
  try {
    for (const food of seedFoods) {
      await db.execute(
        `INSERT INTO foods(
          id,name,category,base_amount,base_unit,calories,protein,carbs,fat,
          is_favorite,is_custom,usage_count,created_at,updated_at
        ) VALUES (?,?,?,?,?,?,?,?,?,0,0,0,?,?)`,
        [...food, now, now]
      );
    }
    await db.execute('COMMIT');
  } catch (error) {
    await db.execute('ROLLBACK');
    throw error;
  }
}
