import {
  Apple,
  CalendarDays,
  ChevronRight,
  Dumbbell,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { useMemo } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useNutritionStore } from '../store/useNutritionStore';
import type { FoodEntry, MealType } from '../types';
import { localDateKey } from '../utils/date';
import { ProgressCard } from './ProgressCard';

const meals: MealType[] = ['早餐', '午餐', '晚餐', '加餐'];
const numberFormat = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 1 });

function dateLabel(date: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(new Date(`${date}T12:00:00`));
}

interface DashboardPageProps {
  chartData: Array<{ day: string; value: number }>;
  saving: boolean;
  onAddFood: (meal?: MealType) => void;
  onEditFood: (entry: FoodEntry) => void;
  onDeleteFood: (entry: FoodEntry) => void;
  onAddPostWorkoutSnack: () => void;
}

export function DashboardPage({
  chartData,
  saving,
  onAddFood,
  onEditFood,
  onDeleteFood,
  onAddPostWorkoutSnack,
}: DashboardPageProps) {
  const {
    foods,
    goal,
    trainingDay,
    selectedDate,
    loading,
    toggleTrainingDay,
    loadDate,
    error,
  } = useNutritionStore();

  const isToday = selectedDate === localDateKey();
  const recordLabel = isToday ? '今天' : dateLabel(selectedDate).replace(/星期.*/, '').trim();
  const totals = useMemo(() => foods.reduce((total, food) => ({
    calories: total.calories + food.calories,
    protein: total.protein + food.protein,
    carbs: total.carbs + food.carbs,
    fat: total.fat + food.fat,
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 }), [foods]);
  const caloriePercent = goal.calories > 0 ? Math.round((totals.calories / goal.calories) * 100) : 0;

  return (
    <>
      <header>
        <div>
          <p className="eyebrow">{dateLabel(selectedDate)}</p>
          <h1>{isToday ? '今天继续稳步完成营养目标。' : `查看 ${recordLabel} 的饮食记录。`}</h1>
        </div>
        <div className="header-actions">
          <label className="date-picker" aria-label="选择记录日期">
            <CalendarDays size={17} />
            <input type="date" value={selectedDate} disabled={loading || saving} onChange={(event) => void loadDate(event.target.value)} />
          </label>
          {!isToday && <button className="ghost" disabled={loading || saving} onClick={() => void loadDate(localDateKey())}>返回今天</button>}
          <button className="day-toggle" disabled={loading || saving} onClick={() => void toggleTrainingDay()}><Dumbbell size={17} />{trainingDay ? '训练日' : '休息日'}</button>
          <button className="primary" disabled={loading || saving} onClick={() => onAddFood()}><Plus size={18} />记录饮食</button>
        </div>
      </header>

      {error && <p className="form-error" role="alert">数据操作失败：{error}</p>}
      {loading && <p className="data-status" role="status">正在读取 {recordLabel} 的饮食记录…</p>}

      <section className="hero">
        <div>
          <span>{recordLabel}热量</span>
          <strong>{numberFormat.format(totals.calories)} <small>/ {goal.calories} kcal</small></strong>
          <p>{totals.calories <= goal.calories ? `还可摄入 ${numberFormat.format(goal.calories - totals.calories)} kcal` : `已超出 ${numberFormat.format(totals.calories - goal.calories)} kcal`}</p>
        </div>
        <div className="hero-ring" style={{ '--progress': `${Math.min(100, Math.max(0, caloriePercent)) * 3.6}deg` } as React.CSSProperties}><span>{caloriePercent}%</span></div>
      </section>

      <section className="macro-grid">
        <ProgressCard label="蛋白质" value={totals.protein} target={goal.protein} unit="g" />
        <ProgressCard label="碳水化合物" value={totals.carbs} target={goal.carbs} unit="g" />
        <ProgressCard label="脂肪" value={totals.fat} target={goal.fat} unit="g" />
      </section>

      <div className="content-grid">
        <section className="panel meals-panel">
          <div className="panel-title">
            <div><p className="eyebrow">{recordLabel}的记录</p><h2>饮食明细</h2></div>
            <button className="ghost" disabled={loading || saving} onClick={() => onAddFood()}><Search size={17} />添加食物</button>
          </div>
          {meals.map((meal) => {
            const mealFoods = foods.filter((food) => food.meal === meal);
            return (
              <div className="meal" key={meal}>
                <div className="meal-head">
                  <div><span className="meal-icon"><Apple size={16} /></span><strong>{meal}</strong></div>
                  <span>{numberFormat.format(mealFoods.reduce((sum, food) => sum + food.calories, 0))} kcal</span>
                </div>
                {mealFoods.length === 0
                  ? <button className="empty-add" disabled={loading || saving} onClick={() => onAddFood(meal)}><Plus size={16} />添加{meal}</button>
                  : mealFoods.map((food) => (
                    <div className="food-row" key={food.id}>
                      <div><strong>{food.name}</strong><span>{numberFormat.format(food.amount)}{food.unit} · 蛋白质 {numberFormat.format(food.protein)}g</span></div>
                      <div>
                        <strong>{numberFormat.format(food.calories)} kcal</strong>
                        <button aria-label={`编辑${food.name}`} title="编辑" disabled={saving} onClick={() => onEditFood(food)}><Pencil size={15} /></button>
                        <button aria-label={`删除${food.name}`} title="删除" disabled={saving} onClick={() => onDeleteFood(food)}><Trash2 size={15} /></button>
                      </div>
                    </div>
                  ))}
              </div>
            );
          })}
        </section>

        <aside className="right-column">
          <section className="panel">
            <div className="panel-title compact"><div><p className="eyebrow">最近 7 天</p><h2>真实热量趋势</h2></div><ChevronRight size={18} /></div>
            <div className="chart">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs><linearGradient id="fill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="currentColor" stopOpacity={0.28} /><stop offset="95%" stopColor="currentColor" stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} />
                  <YAxis hide domain={[0, 'auto']} />
                  <Tooltip formatter={(value) => [`${numberFormat.format(Number(value))} kcal`, '热量']} />
                  <Area type="monotone" dataKey="value" stroke="currentColor" fill="url(#fill)" strokeWidth={3} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>
          <section className="panel quick-panel">
            <div className="panel-title compact"><div><p className="eyebrow">效率工具</p><h2>快捷操作</h2></div></div>
            <button onClick={() => onAddFood()}><CalendarDays size={18} /><span><strong>手动添加饮食</strong><small>记录到当前选择日期</small></span><ChevronRight size={17} /></button>
            <button disabled={saving} onClick={onAddPostWorkoutSnack}><Dumbbell size={18} /><span><strong>训练后加餐</strong><small>蛋白粉 + 香蕉</small></span><ChevronRight size={17} /></button>
            <button onClick={() => onAddFood('加餐')}><Apple size={18} /><span><strong>添加自定义加餐</strong><small>快速补充当日营养</small></span><ChevronRight size={17} /></button>
          </section>
        </aside>
      </div>
    </>
  );
}
