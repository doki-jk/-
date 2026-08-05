import { useMemo } from 'react';
import { Apple, CalendarDays, Plus, Trash2 } from 'lucide-react';
import { useNutritionStore } from '../store/useNutritionStore';
import type { MealType } from '../types';
import '../meal-records.css';

const meals: MealType[] = ['早餐', '午餐', '晚餐', '加餐'];
const numberFormat = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 1 });

function localDateKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function MealRecords({ onAddFood }: { onAddFood: (meal?: MealType) => void }) {
  const { foods, goal, selectedDate, loading, error, loadDate, removeFood } = useNutritionStore();
  const totals = useMemo(() => foods.reduce((sum, food) => ({
    calories: sum.calories + food.calories,
    protein: sum.protein + food.protein,
    carbs: sum.carbs + food.carbs,
    fat: sum.fat + food.fat,
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 }), [foods]);

  async function remove(id: string) {
    try {
      await removeFood(id);
    } catch {
      // Store 会显示具体错误。
    }
  }

  return (
    <section className="meal-records-page">
      <div className="settings-heading meal-records-heading">
        <div>
          <p className="eyebrow">按天管理</p>
          <h1>饮食记录</h1>
          <p>集中查看某一天的每一餐，并快速添加或删除记录。</p>
        </div>
        <div className="meal-record-actions">
          <label className="date-picker"><CalendarDays size={17} /><input type="date" value={selectedDate} disabled={loading} onChange={(event) => void loadDate(event.target.value)} /></label>
          {selectedDate !== localDateKey() && <button className="ghost" onClick={() => void loadDate(localDateKey())}>返回今天</button>}
          <button className="primary" onClick={() => onAddFood()}><Plus size={17} />添加记录</button>
        </div>
      </div>

      {error && <p className="form-error">数据操作失败：{error}</p>}
      {loading && <p className="data-status">正在读取饮食记录…</p>}

      <div className="meal-record-summary">
        <article><span>热量</span><strong>{numberFormat.format(totals.calories)}</strong><small>/ {goal.calories} kcal</small></article>
        <article><span>蛋白质</span><strong>{numberFormat.format(totals.protein)}</strong><small>/ {goal.protein} g</small></article>
        <article><span>碳水</span><strong>{numberFormat.format(totals.carbs)}</strong><small>/ {goal.carbs} g</small></article>
        <article><span>脂肪</span><strong>{numberFormat.format(totals.fat)}</strong><small>/ {goal.fat} g</small></article>
      </div>

      <div className="meal-record-groups">
        {meals.map((meal) => {
          const entries = foods.filter((food) => food.meal === meal);
          const calories = entries.reduce((sum, food) => sum + food.calories, 0);
          return (
            <section className="panel meal-record-group" key={meal}>
              <div className="meal-record-group-title">
                <div><span><Apple size={17} /></span><div><h2>{meal}</h2><small>{numberFormat.format(calories)} kcal</small></div></div>
                <button className="ghost" onClick={() => onAddFood(meal)}><Plus size={15} />添加</button>
              </div>
              {entries.length === 0 ? <p className="empty-state">这一餐还没有记录。</p> : entries.map((food) => (
                <article className="meal-record-row" key={food.id}>
                  <div><strong>{food.name}</strong><span>{numberFormat.format(food.amount)} {food.unit}</span></div>
                  <div className="meal-record-macros"><span>蛋白 {numberFormat.format(food.protein)}g</span><span>碳水 {numberFormat.format(food.carbs)}g</span><span>脂肪 {numberFormat.format(food.fat)}g</span></div>
                  <strong>{numberFormat.format(food.calories)} kcal</strong>
                  <button aria-label={`删除${food.name}`} onClick={() => void remove(food.id)}><Trash2 size={16} /></button>
                </article>
              ))}
            </section>
          );
        })}
      </div>
    </section>
  );
}
